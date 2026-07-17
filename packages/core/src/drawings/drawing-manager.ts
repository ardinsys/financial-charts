import type {
  ChartContext,
  ChartPlugin,
  ChartPointerEvent,
} from "../plugin/chart-plugin";
import type { Pane } from "../panes/pane";
import { bindEvent, type Dispose } from "../utils/dom";
import {
  anchorFromPoint,
  Drawing,
  type DrawingAnchor,
  type DrawingHitTestContext,
  type DrawingJSON,
  type DrawingPoint,
} from "./drawing";
import { HorizontalLine } from "./horizontal-line";
import { RectangleDrawing } from "./rectangle";
import { TextDrawing } from "./text";
import { TrendLine } from "./trendline";

export type DrawingFactory = (options: {
  readonly anchors: readonly DrawingAnchor[];
  readonly paneId: number;
}) => Drawing;

export interface DrawingFactoryDescriptor {
  /** Fixed number of anchors required before the preview is finalized. */
  readonly anchorCount: number;
  /** Creates the preview with `anchorCount` initialized anchors. */
  readonly create: DrawingFactory;
}

export type DrawingCreationFactory = DrawingFactory | DrawingFactoryDescriptor;

export type DrawingDeserializer = (json: DrawingJSON) => Drawing;

export interface DrawingManagerJSON {
  readonly drawings: readonly DrawingJSON[];
  readonly selectedDrawingId?: string;
}

export interface DrawingManagerOptions {
  readonly drawingDeserializers?: Readonly<Record<string, DrawingDeserializer>>;
  readonly drawingFactory?: DrawingCreationFactory;
  readonly hitTestTolerance?: number;
}

const builtInDrawingDeserializers: Record<string, DrawingDeserializer> = {
  [HorizontalLine.type]: HorizontalLine.fromJSON,
  [RectangleDrawing.type]: RectangleDrawing.fromJSON,
  [TextDrawing.type]: TextDrawing.fromJSON,
  [TrendLine.type]: TrendLine.fromJSON,
};

type Interaction =
  | {
      type: "creating";
      drawing: Drawing;
      announced: boolean;
      anchorCount: number;
      placedAnchorCount: number;
      pointerActive: boolean;
      commitOnUp: boolean;
      pointerStart: DrawingAnchor;
      pane: Pane;
    }
  | {
      type: "dragging";
      drawing: Drawing;
      start: DrawingAnchor;
      anchors: readonly DrawingAnchor[];
      pane: Pane;
    }
  | {
      type: "anchor";
      drawing: Drawing;
      index: number;
      anchors: readonly DrawingAnchor[];
      pane: Pane;
    };

type DrawingHistoryEntry =
  | {
      type: "create";
      drawing: Drawing;
      index: number;
    }
  | {
      type: "delete";
      drawing: Drawing;
      index: number;
    }
  | {
      type: "move";
      drawing: Drawing;
      before: readonly DrawingAnchor[];
      after: readonly DrawingAnchor[];
    };

export interface DrawingSelectionOptions {
  /** Emits `drawing-select` when the selection changes. Defaults to `true`. */
  readonly emit?: boolean;
  /** Re-emits selection even when the selected object is unchanged. */
  readonly force?: boolean;
}

export interface DrawingMutationOptions {
  /** Emits the matching create/change/delete event. Defaults to `false`. */
  readonly emit?: boolean;
  /**
   * Emits `drawing-select` when the mutation changes selection. Defaults to
   * `true`.
   */
  readonly emitSelection?: boolean;
}

export class DrawingManager implements ChartPlugin {
  readonly key = "drawing-manager";

  private ctx?: ChartContext;
  private drawings: readonly Drawing[] = [];
  private selectedDrawing?: Drawing;
  private interaction?: Interaction;
  private drawingFactory?: DrawingFactoryDescriptor;
  private drawingDeserializers: Map<string, DrawingDeserializer>;
  private hitTestTolerance: number;
  private undoStack: DrawingHistoryEntry[] = [];
  private redoStack: DrawingHistoryEntry[] = [];
  private keyboardDisposer?: Dispose;
  private keyboardHost?: HTMLElement;
  private addedKeyboardTabIndex = false;

  constructor(options: DrawingManagerOptions = {}) {
    this.setDrawingFactory(options.drawingFactory);
    this.drawingDeserializers = new Map(
      Object.entries(builtInDrawingDeserializers)
    );
    for (const [type, deserializer] of Object.entries(
      options.drawingDeserializers ?? {}
    )) {
      this.registerDrawingDeserializer(type, deserializer);
    }
    this.hitTestTolerance = options.hitTestTolerance ?? 8;
  }

  attach(ctx: ChartContext) {
    if (this.ctx && !this.ctx.signal.aborted) {
      throw new Error("DrawingManager is already attached to a chart.");
    }
    this.ctx = ctx;
    for (const drawing of this.drawings) this.bindDrawingMutation(drawing);
    this.bindKeyboard();
    if (this.selectedDrawing) {
      this.emitDrawingSelection(this.selectedDrawing);
    }
  }

  setDrawingFactory(factory?: DrawingCreationFactory) {
    this.drawingFactory = factory
      ? normalizeDrawingFactory(factory)
      : undefined;
  }

  /** Registers a serialized drawing type and returns an idempotent disposer. */
  registerDrawingDeserializer(type: string, deserializer: DrawingDeserializer) {
    if (typeof type !== "string" || type.trim().length === 0) {
      throw new TypeError(
        "Drawing deserializer type must be a non-empty string."
      );
    }
    const previous = this.drawingDeserializers.get(type);
    this.drawingDeserializers.set(type, deserializer);
    return () => {
      if (this.drawingDeserializers.get(type) !== deserializer) return;
      if (previous) {
        this.drawingDeserializers.set(type, previous);
      } else {
        this.drawingDeserializers.delete(type);
      }
    };
  }

  getDrawings(): readonly Drawing[] {
    return this.drawings;
  }

  /** Returns a managed drawing by its unique identity. */
  getDrawingById(id: string) {
    return this.drawings.find((drawing) => drawing.id === id);
  }

  getSelectedDrawing() {
    return this.selectedDrawing;
  }

  /** Clears drawing state and history, returning the removed drawings. */
  clearDrawings(options: DrawingMutationOptions = {}) {
    const drawings = this.getDrawings();
    const hadSelection = this.selectedDrawing !== undefined;
    this.interaction = undefined;
    this.selectedDrawing?.setSelected(false);
    this.selectedDrawing = undefined;
    if (drawings.length > 0) {
      for (const drawing of drawings) drawing.bindMutationHandler();
      this.drawings = [];
    }
    this.undoStack = [];
    this.redoStack = [];

    if (options.emit) {
      for (const drawing of drawings) {
        this.ctx?.emit("drawing-delete", { drawing });
      }
    }
    if (hadSelection && (options.emitSelection ?? true)) {
      this.emitDrawingSelection(undefined);
    }
    this.ctx?.requestRedraw("drawings");
    return drawings;
  }

  addDrawing(drawing: Drawing, options: DrawingMutationOptions = {}) {
    this.assertDrawingType(drawing.type);
    this.assertUniqueDrawingId(drawing.id);
    this.bindDrawingMutation(drawing);
    this.drawings = [...this.drawings, drawing];
    if (options.emit) {
      this.ctx?.emit("drawing-create", { drawing });
    }
    this.selectDrawing(drawing, { emit: options.emitSelection ?? true });
    this.ctx?.requestRedraw("drawings");
    return drawing;
  }

  upsertDrawing(json: DrawingJSON, options: DrawingMutationOptions = {}) {
    const existingIndex = this.drawings.findIndex(
      (drawing) => drawing.id === json.id
    );
    const wasSelected = this.selectedDrawing?.id === json.id;
    const drawing = this.deserializeDrawing(json);

    drawing.setSelected(wasSelected);
    this.bindDrawingMutation(drawing);
    if (existingIndex === -1) {
      this.drawings = [...this.drawings, drawing];
      if (options.emit) {
        this.ctx?.emit("drawing-create", { drawing });
      }
    } else {
      const existing = this.drawings[existingIndex];
      existing.bindMutationHandler();
      existing.setSelected(false);
      if (this.interaction?.drawing === existing) {
        this.interaction = undefined;
      }
      this.drawings = this.drawings.map((item, index) =>
        index === existingIndex ? drawing : item
      );
      if (options.emit) {
        this.emitDrawingChange(drawing);
      }
    }

    if (wasSelected) {
      this.selectedDrawing = drawing;
      if (options.emitSelection ?? true) {
        this.emitDrawingSelection(drawing);
      }
    }
    this.ctx?.requestRedraw("drawings");
    return drawing;
  }

  /** @internal Applies remote anchors without replacing the managed drawing. */
  applyDrawingAnchors(
    id: string,
    anchors: readonly DrawingAnchor[],
    options: DrawingMutationOptions = {}
  ) {
    const drawing = this.getDrawingById(id);
    if (!drawing) return undefined;

    drawing.setAnchors(anchors);
    if (options.emit) {
      this.emitDrawingChange(drawing);
    }
    this.ctx?.requestRedraw("drawings");
    return drawing;
  }

  selectDrawing(drawing?: Drawing, options: DrawingSelectionOptions = {}) {
    const { emit = true, force = false } = options;
    if (drawing && !this.drawings.includes(drawing)) {
      throw new Error("Cannot select a drawing that is not managed.");
    }
    if (this.selectedDrawing === drawing && !force) return;

    this.selectedDrawing?.setSelected(false);
    this.selectedDrawing = drawing;
    this.selectedDrawing?.setSelected(true);

    if (emit) {
      this.emitDrawingSelection(drawing);
    }
    this.ctx?.requestRedraw("drawings");
  }

  deleteSelected() {
    if (!this.selectedDrawing) return false;
    return this.deleteDrawing(this.selectedDrawing);
  }

  deleteDrawing(drawing: Drawing) {
    const index = this.removeDrawing(drawing);
    if (index === undefined) return false;

    this.recordHistory({ type: "delete", drawing, index });
    this.ctx?.emit("drawing-delete", { drawing });
    return true;
  }

  removeDrawingById(id: string, options: DrawingMutationOptions = {}) {
    const drawing = this.drawings.find((candidate) => candidate.id === id);
    if (!drawing) return false;

    const removed = this.removeDrawing(drawing, {
      emit: options.emitSelection ?? true,
    });
    if (removed === undefined) return false;

    if (options.emit) {
      this.ctx?.emit("drawing-delete", { drawing });
    }
    return true;
  }

  selectDrawingById(id?: string, options: DrawingSelectionOptions = {}) {
    if (!id) {
      this.selectDrawing(undefined, options);
      return undefined;
    }

    const drawing = this.drawings.find((candidate) => candidate.id === id);
    if (!drawing) return undefined;
    this.selectDrawing(drawing, options);
    return drawing;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return false;

    this.applyHistory(entry, "undo");
    this.redoStack.push(entry);
    return true;
  }

  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return false;

    this.applyHistory(entry, "redo");
    this.undoStack.push(entry);
    return true;
  }

  private removeDrawing(
    drawing: Drawing,
    selectionOptions: DrawingSelectionOptions = {}
  ) {
    const index = this.drawings.indexOf(drawing);
    if (index === -1) return undefined;

    this.drawings = this.drawings.filter(
      (_candidate, candidateIndex) => candidateIndex !== index
    );
    drawing.bindMutationHandler();
    if (this.selectedDrawing === drawing) {
      this.selectDrawing(undefined, selectionOptions);
    }
    if (this.interaction?.drawing === drawing) {
      this.interaction = undefined;
    }
    this.ctx?.requestRedraw("drawings");
    return index;
  }

  private insertDrawing(drawing: Drawing, index: number) {
    if (
      this.drawings.includes(drawing) ||
      this.drawings.some((candidate) => candidate.id === drawing.id)
    ) {
      return false;
    }

    drawing.setSelected(false);
    this.bindDrawingMutation(drawing);
    const insertionIndex = Math.max(0, Math.min(index, this.drawings.length));
    this.drawings = [
      ...this.drawings.slice(0, insertionIndex),
      drawing,
      ...this.drawings.slice(insertionIndex),
    ];
    this.ctx?.requestRedraw("drawings");
    return true;
  }

  private recordHistory(entry: DrawingHistoryEntry) {
    this.undoStack.push(entry);
    this.redoStack = [];
  }

  private applyHistory(entry: DrawingHistoryEntry, direction: "undo" | "redo") {
    if (entry.type === "create") {
      if (direction === "undo") {
        if (this.removeDrawing(entry.drawing) !== undefined) {
          this.ctx?.emit("drawing-delete", { drawing: entry.drawing });
        }
      } else {
        if (this.insertDrawing(entry.drawing, entry.index)) {
          this.ctx?.emit("drawing-create", { drawing: entry.drawing });
        }
      }
      return;
    }

    if (entry.type === "delete") {
      if (direction === "undo") {
        if (this.insertDrawing(entry.drawing, entry.index)) {
          this.ctx?.emit("drawing-create", { drawing: entry.drawing });
        }
      } else {
        if (this.removeDrawing(entry.drawing) !== undefined) {
          this.ctx?.emit("drawing-delete", { drawing: entry.drawing });
        }
      }
      return;
    }

    if (!this.drawings.includes(entry.drawing)) return;
    entry.drawing.setAnchors(direction === "undo" ? entry.before : entry.after);
    this.emitDrawingChange(entry.drawing);
    this.ctx?.requestRedraw("drawings");
  }

  toJSON(): DrawingManagerJSON {
    return {
      drawings: this.drawings.map((drawing) => drawing.toJSON()),
      ...(this.selectedDrawing
        ? { selectedDrawingId: this.selectedDrawing.id }
        : {}),
    };
  }

  fromJSON(json?: DrawingManagerJSON) {
    const drawings = (json?.drawings ?? []).map((drawing) =>
      this.deserializeDrawing(drawing)
    );
    this.assertUniqueDrawingIds(drawings);
    const selectedDrawing = drawings.find(
      (drawing) => drawing.id === json?.selectedDrawingId
    );
    if (json?.selectedDrawingId !== undefined && !selectedDrawing) {
      throw new Error(
        `Selected drawing "${json.selectedDrawingId}" was not found.`
      );
    }

    this.interaction = undefined;
    this.selectedDrawing?.setSelected(false);
    for (const drawing of this.drawings) drawing.bindMutationHandler();
    this.drawings = drawings;
    for (const drawing of drawings) this.bindDrawingMutation(drawing);
    this.undoStack = [];
    this.redoStack = [];
    this.selectedDrawing = selectedDrawing;
    this.selectedDrawing?.setSelected(true);
    this.emitDrawingSelection(this.selectedDrawing);
    this.ctx?.requestRedraw("drawings");

    return this.getDrawings();
  }

  onPointer(event: ChartPointerEvent) {
    if (!this.ctx) return false;

    if (event.type === "down") {
      if (!this.isPrimaryPointer(event)) return false;
      const pane =
        this.interaction?.type === "creating"
          ? this.interaction.pane
          : event.pane;
      const panePoint = this.toPanePoint(event, pane);
      const anchor = anchorFromPoint(panePoint, pane);
      return this.pointerDown(event, panePoint, anchor);
    } else if (event.type === "move") {
      const pane = this.interaction?.pane ?? event.pane;
      const panePoint = this.toPanePoint(event, pane);
      const anchor = anchorFromPoint(panePoint, pane);
      this.pointerMove(anchor);
      return this.interaction !== undefined;
    } else {
      const handled = this.interaction !== undefined;
      if (event.cancelled) {
        this.cancelInteraction();
      } else {
        this.pointerUp();
      }
      return handled;
    }
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx.getCanvasContext("drawings");
    const sizes = this.ctx.getLogicalCanvas("drawings");

    ctx.clearRect(0, 0, sizes.width, sizes.height);

    for (const drawing of this.drawings) {
      const pane = this.getPane(drawing.getPaneId());
      if (!pane) continue;
      const region = pane.getRegion();
      ctx.save();
      ctx.beginPath();
      ctx.rect(region.x, region.y, region.width, region.height);
      ctx.clip();
      try {
        drawing.draw(ctx, this.getDrawingContext(pane));
      } finally {
        ctx.restore();
      }
    }
  }

  detach() {
    this.keyboardDisposer?.();
    this.keyboardDisposer = undefined;
    this.keyboardHost?.classList.remove("fci-drawing-host");
    if (this.addedKeyboardTabIndex) {
      this.keyboardHost?.removeAttribute("tabindex");
      this.addedKeyboardTabIndex = false;
    }
    this.keyboardHost = undefined;
    for (const drawing of this.drawings) drawing.bindMutationHandler();
    if (this.interaction?.type === "creating") {
      this.discardCreation(this.interaction, false);
    } else {
      this.interaction = undefined;
    }
    if (this.selectedDrawing) {
      this.emitDrawingSelection(undefined);
    }
    this.ctx = undefined;
  }

  hitTest(point: DrawingPoint, pane: Pane) {
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const drawing = this.drawings[i];
      if (drawing.getPaneId() !== pane.getId()) continue;
      if (drawing.hitTest(point, this.getHitTestContext(pane))) {
        return drawing;
      }
    }

    return undefined;
  }

  private pointerDown(
    event: ChartPointerEvent,
    panePoint: DrawingPoint,
    anchor: DrawingAnchor
  ) {
    this.focusKeyboardHost();

    if (this.interaction?.type === "creating") {
      this.interaction.pointerActive = true;
      this.interaction.commitOnUp = true;
      this.interaction.pointerStart = anchor;
      this.updateCreationPreview(this.interaction, anchor);
      return true;
    }

    const selectedAnchor = this.hitTestSelectedAnchor(panePoint, event.pane);
    if (selectedAnchor) {
      this.interaction = {
        type: "anchor",
        drawing: selectedAnchor.drawing,
        index: selectedAnchor.index,
        anchors: selectedAnchor.drawing.getAnchors(),
        pane: event.pane,
      };
      return true;
    }

    const hitDrawing = this.hitTest(panePoint, event.pane);
    if (hitDrawing) {
      this.selectDrawing(hitDrawing);
      this.interaction = {
        type: "dragging",
        drawing: hitDrawing,
        start: anchor,
        anchors: hitDrawing.getAnchors(),
        pane: event.pane,
      };
      return true;
    }

    if (!this.drawingFactory) {
      this.selectDrawing(undefined);
      return false;
    }

    const { anchorCount, create } = this.drawingFactory;
    const drawing = create({
      anchors: Array.from({ length: anchorCount }, () => anchor),
      paneId: event.pane.getId(),
    });
    this.assertDrawingType(drawing.type);
    this.assertUniqueDrawingId(drawing.id);
    this.drawings = [...this.drawings, drawing];
    this.bindDrawingMutation(drawing);
    this.interaction = {
      type: "creating",
      drawing,
      announced: false,
      anchorCount,
      placedAnchorCount: 1,
      pointerActive: true,
      commitOnUp: false,
      pointerStart: anchor,
      pane: event.pane,
    };
    this.ctx?.requestRedraw("drawings");
    return true;
  }

  private pointerMove(anchor: DrawingAnchor) {
    if (!this.interaction) return;

    if (this.interaction.type === "creating") {
      if (
        this.interaction.pointerActive &&
        !sameAnchor(this.interaction.pointerStart, anchor)
      ) {
        this.interaction.commitOnUp = true;
      }
      this.updateCreationPreview(this.interaction, anchor);
      return;
    }

    if (this.interaction.type === "anchor") {
      this.interaction.drawing.moveAnchor(this.interaction.index, anchor);
      this.emitDrawingChange(this.interaction.drawing);
      this.ctx?.requestRedraw("drawings");
      return;
    }

    const delta = {
      index: anchor.index - this.interaction.start.index,
      price: anchor.price - this.interaction.start.price,
    };
    this.interaction.drawing.setAnchors(
      this.interaction.anchors.map((originalAnchor) => ({
        index: originalAnchor.index + delta.index,
        price: originalAnchor.price + delta.price,
      }))
    );
    this.emitDrawingChange(this.interaction.drawing);
    this.ctx?.requestRedraw("drawings");
  }

  private pointerUp() {
    if (!this.interaction) return;

    if (this.interaction.type === "creating") {
      const creation = this.interaction;
      if (!creation.pointerActive) return;
      creation.pointerActive = false;

      if (creation.anchorCount === 1) {
        this.finishCreation(creation);
        return;
      }
      if (!creation.commitOnUp) return;

      creation.placedAnchorCount += 1;
      creation.commitOnUp = false;
      if (creation.placedAnchorCount >= creation.anchorCount) {
        this.finishCreation(creation);
      }
      return;
    }

    const drawing = this.interaction.drawing;
    const before = this.interaction.anchors;
    const after = drawing.getAnchors();
    if (!this.sameAnchors(before, after)) {
      this.recordHistory({ type: "move", drawing, before, after });
      this.emitDrawingFinished(drawing, "move");
    }
    this.interaction = undefined;
  }

  private cancelInteraction() {
    if (!this.interaction) return;

    if (this.interaction.type === "creating") {
      this.discardCreation(this.interaction, false);
      return;
    }

    this.interaction.drawing.setAnchors(this.interaction.anchors);
    this.emitDrawingChange(this.interaction.drawing);
    this.interaction = undefined;
    this.ctx?.requestRedraw("drawings");
  }

  private updateCreationPreview(
    creation: Extract<Interaction, { type: "creating" }>,
    anchor: DrawingAnchor
  ) {
    const anchors = [...creation.drawing.getAnchors()];
    for (
      let index = creation.placedAnchorCount;
      index < creation.anchorCount;
      index++
    ) {
      anchors[index] = anchor;
    }
    creation.drawing.setAnchors(anchors);
    this.emitDrawingChange(creation.drawing);
    this.ctx?.requestRedraw("drawings");
  }

  private finishCreation(creation: Extract<Interaction, { type: "creating" }>) {
    const drawing = creation.drawing;
    const index = this.drawings.indexOf(drawing);
    if (index !== -1) {
      this.recordHistory({ type: "create", drawing, index });
    }
    this.ctx?.emit("drawing-create", { drawing });
    this.interaction = undefined;
    this.setDrawingFactory(undefined);
    this.emitDrawingFinished(drawing, "create");
    this.selectDrawing(drawing, { force: true });
  }

  private emitDrawingFinished(drawing: Drawing, operation: "create" | "move") {
    this.ctx?.emit("drawing-finished", {
      drawing,
      operation,
      id: drawing.id,
      type: drawing.type,
      paneId: drawing.getPaneId(),
      anchors: drawing.getAnchors(),
      json: drawing.toJSON(),
    });
  }

  private emitDrawingSelection(drawing?: Drawing) {
    this.ctx?.emit(
      "drawing-select",
      drawing
        ? {
            drawing,
            id: drawing.id,
            type: drawing.type,
            paneId: drawing.getPaneId(),
            anchors: drawing.getAnchors(),
            json: drawing.toJSON(),
          }
        : { drawing: undefined }
    );
  }

  private hitTestSelectedAnchor(point: DrawingPoint, pane: Pane) {
    const drawing = this.selectedDrawing;
    if (!drawing || drawing.getPaneId() !== pane.getId()) return undefined;

    const index = drawing.hitTestAnchor(point, this.getHitTestContext(pane));
    if (index === undefined) return undefined;

    return { drawing, index };
  }

  private getHitTestContext(pane: Pane): DrawingHitTestContext {
    return {
      ...this.getDrawingContext(pane),
      tolerance: this.hitTestTolerance,
    };
  }

  private getDrawingContext(pane: Pane) {
    const ctx = this.requireContext();
    const theme = ctx.getOptions().theme;
    return {
      pane,
      canvas: ctx.getCanvasContext("drawings").canvas,
      handleTheme: {
        centerColor: theme.yAxis.color,
        fillColor: theme.backgroundColor,
        strokeColor: theme.crosshair.color,
      },
    };
  }

  private bindKeyboard() {
    const host = this.requireContext().hostElement;
    this.keyboardHost = host;
    if (!host.hasAttribute("tabindex")) {
      host.tabIndex = 0;
      this.addedKeyboardTabIndex = true;
    }
    host.classList.add("fci-drawing-host");
    this.keyboardDisposer = bindEvent(host, "keydown", this.onKeyDown);
  }

  private focusKeyboardHost() {
    this.keyboardHost?.focus({ preventScroll: true });
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.isEditableTarget(event.target)) return;

    const key = event.key.toLowerCase();
    const modifier = event.metaKey || event.ctrlKey;
    let handled = false;

    if (event.key === "Escape") {
      handled = this.cancelCreation();
    } else if (
      (event.key === "Delete" || event.key === "Backspace") &&
      !modifier
    ) {
      handled = this.deleteSelected();
    } else if (modifier && key === "z") {
      handled = event.shiftKey ? this.redo() : this.undo();
    } else if (event.ctrlKey && key === "y") {
      handled = this.redo();
    }

    if (!handled) return;

    event.preventDefault();
    event.stopPropagation();
  };

  private cancelCreation(): boolean {
    if (this.interaction?.type !== "creating") return false;

    this.discardCreation(this.interaction, true);
    return true;
  }

  private discardCreation(
    creation: Extract<Interaction, { type: "creating" }>,
    clearFactory: boolean
  ) {
    this.interaction = undefined;
    creation.drawing.bindMutationHandler();
    this.drawings = this.drawings.filter(
      (candidate) => candidate !== creation.drawing
    );
    if (clearFactory) this.setDrawingFactory(undefined);
    if (creation.announced) {
      this.ctx?.emit("drawing-delete", { drawing: creation.drawing });
    }
    this.ctx?.requestRedraw("drawings");
  }

  private isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return Boolean(
      target.closest("input, textarea, select, [contenteditable='true']")
    );
  }

  private sameAnchors(
    a: readonly DrawingAnchor[],
    b: readonly DrawingAnchor[]
  ) {
    if (a.length !== b.length) return false;
    return a.every(
      (anchor, index) =>
        anchor.index === b[index].index && anchor.price === b[index].price
    );
  }

  private isPrimaryPointer(event: ChartPointerEvent) {
    return event.button === undefined || event.button === 0;
  }

  private toPanePoint(event: ChartPointerEvent, pane: Pane): DrawingPoint {
    const region = pane.getRegion();
    return {
      x: event.x,
      y: Math.max(region.y, Math.min(event.y, region.y + region.height)),
    };
  }

  private getPane(paneId: number) {
    return this.requireContext()
      .getPanes()
      .find((pane) => pane.getId() === paneId);
  }

  private bindDrawingMutation(drawing: Drawing): void {
    drawing.bindMutationHandler(() => {
      if (!this.drawings.includes(drawing)) return;
      this.emitDrawingChange(drawing);
      this.ctx?.requestRedraw("drawings");
    });
  }

  private emitDrawingChange(drawing: Drawing): void {
    if (!this.ctx) return;
    if (
      this.interaction?.type === "creating" &&
      this.interaction.drawing === drawing
    ) {
      this.interaction.announced = true;
    }
    this.ctx.emit("drawing-change", { drawing });
  }

  private deserializeDrawing(json: DrawingJSON) {
    const deserializer = this.drawingDeserializers.get(json.type);
    if (!deserializer) {
      throw new Error(`Unknown drawing type: ${json.type}`);
    }

    const drawing = deserializer(json);
    this.assertDrawingType(drawing.type);
    if (drawing.id !== json.id || drawing.type !== json.type) {
      throw new Error(
        `Drawing deserializer for "${json.type}" must preserve id and type.`
      );
    }
    return drawing;
  }

  private assertUniqueDrawingId(id: string) {
    if (this.drawings.some((drawing) => drawing.id === id)) {
      throw new Error(`Drawing id "${id}" is already registered.`);
    }
  }

  private assertDrawingType(type: string) {
    if (typeof type !== "string" || type.trim().length === 0) {
      throw new TypeError("Drawing type must be a non-empty string.");
    }
  }

  private assertUniqueDrawingIds(drawings: readonly Drawing[]) {
    const ids = new Set<string>();
    for (const drawing of drawings) {
      if (ids.has(drawing.id)) {
        throw new Error(`Drawing id "${drawing.id}" is duplicated.`);
      }
      ids.add(drawing.id);
    }
  }

  private requireContext() {
    if (!this.ctx) {
      throw new Error("DrawingManager is not attached to a chart.");
    }
    return this.ctx;
  }
}

function normalizeDrawingFactory(
  factory: DrawingCreationFactory
): DrawingFactoryDescriptor {
  const descriptor =
    typeof factory === "function"
      ? { anchorCount: 2, create: factory }
      : factory;
  if (typeof descriptor.create !== "function") {
    throw new TypeError("Drawing factory create must be a function.");
  }
  if (!Number.isInteger(descriptor.anchorCount) || descriptor.anchorCount < 1) {
    throw new RangeError(
      "Drawing factory anchorCount must be a positive integer."
    );
  }
  return descriptor;
}

function sameAnchor(left: DrawingAnchor, right: DrawingAnchor) {
  return left.index === right.index && left.price === right.price;
}
