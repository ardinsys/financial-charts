import type {
  ChartContext,
  ChartPlugin,
  ChartPointerEvent
} from "../plugin/chart-plugin";
import type { Pane } from "../panes/pane";
import {
  anchorFromPoint,
  Drawing,
  type DrawingAnchor,
  type DrawingPoint
} from "./drawing";

export type DrawingFactory = (options: {
  anchors: DrawingAnchor[];
  paneId: number;
}) => Drawing;

export interface DrawingManagerOptions {
  drawingFactory?: DrawingFactory;
  hitTestTolerance?: number;
}

type Interaction =
  | {
      type: "creating";
      drawing: Drawing;
      start: DrawingAnchor;
    }
  | {
      type: "dragging";
      drawing: Drawing;
      start: DrawingAnchor;
      anchors: DrawingAnchor[];
    };

export class DrawingManager implements ChartPlugin {
  readonly key = "drawing-manager";

  private ctx!: ChartContext;
  private drawings: Drawing[] = [];
  private selectedDrawing?: Drawing;
  private interaction?: Interaction;
  private drawingFactory?: DrawingFactory;
  private hitTestTolerance: number;

  constructor(options: DrawingManagerOptions = {}) {
    this.drawingFactory = options.drawingFactory;
    this.hitTestTolerance = options.hitTestTolerance ?? 8;
  }

  attach(ctx: ChartContext) {
    this.ctx = ctx;
  }

  setDrawingFactory(factory?: DrawingFactory) {
    this.drawingFactory = factory;
  }

  getDrawings() {
    return [...this.drawings];
  }

  getSelectedDrawing() {
    return this.selectedDrawing;
  }

  addDrawing(drawing: Drawing) {
    this.drawings.push(drawing);
    this.selectDrawing(drawing);
    this.ctx.requestRedraw("drawings");
    return drawing;
  }

  selectDrawing(drawing?: Drawing) {
    if (this.selectedDrawing === drawing) return;

    this.selectedDrawing?.setSelected(false);
    this.selectedDrawing = drawing;
    this.selectedDrawing?.setSelected(true);

    if (drawing) {
      this.ctx.chart.emit("drawing-select", { drawing });
    }
    this.ctx.requestRedraw("drawings");
  }

  deleteSelected() {
    if (!this.selectedDrawing) return;
    this.deleteDrawing(this.selectedDrawing);
  }

  deleteDrawing(drawing: Drawing) {
    if (!this.drawings.includes(drawing)) return;

    this.drawings = this.drawings.filter((item) => item !== drawing);
    if (this.selectedDrawing === drawing) {
      this.selectedDrawing.setSelected(false);
      this.selectedDrawing = undefined;
    }
    if (this.interaction?.drawing === drawing) {
      this.interaction = undefined;
    }
    this.ctx.chart.emit("drawing-delete", { drawing });
    this.ctx.requestRedraw("drawings");
  }

  onPointer(event: ChartPointerEvent) {
    const panePoint = this.toPanePoint(event);
    const anchor = anchorFromPoint(panePoint, event.pane);

    if (event.type === "down") {
      this.pointerDown(event, panePoint, anchor);
    } else if (event.type === "move") {
      this.pointerMove(anchor);
    } else {
      this.pointerUp();
    }
  }

  draw() {
    const chart = this.ctx.chart;
    const ctx = chart.getContext("drawings");
    const sizes = chart.getLogicalCanvas("drawings");

    ctx.clearRect(0, 0, sizes.width, sizes.height);

    for (const drawing of this.drawings) {
      const pane = this.getPane(drawing.getPaneId());
      if (!pane) continue;
      drawing.draw(ctx, {
        pane,
        canvas: ctx.canvas
      });
    }
  }

  detach() {
    this.interaction = undefined;
    this.selectDrawing(undefined);
    this.drawings = [];
  }

  hitTest(point: DrawingPoint, pane: Pane) {
    for (let i = this.drawings.length - 1; i >= 0; i--) {
      const drawing = this.drawings[i];
      if (drawing.getPaneId() !== pane.getId()) continue;
      if (
        drawing.hitTest(point, {
          pane,
          canvas: this.ctx.chart.getContext("drawings").canvas,
          tolerance: this.hitTestTolerance
        })
      ) {
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
    const hitDrawing = this.hitTest(panePoint, event.pane);
    if (hitDrawing) {
      this.selectDrawing(hitDrawing);
      this.interaction = {
        type: "dragging",
        drawing: hitDrawing,
        start: anchor,
        anchors: hitDrawing.getAnchors()
      };
      return;
    }

    if (!this.drawingFactory) {
      this.selectDrawing(undefined);
      return;
    }

    const drawing = this.drawingFactory({
      anchors: [anchor, anchor],
      paneId: event.pane.getId()
    });
    this.drawings.push(drawing);
    this.selectDrawing(drawing);
    this.interaction = {
      type: "creating",
      drawing,
      start: anchor
    };
    this.ctx.requestRedraw("drawings");
  }

  private pointerMove(anchor: DrawingAnchor) {
    if (!this.interaction) return;

    if (this.interaction.type === "creating") {
      this.interaction.drawing.setAnchors([this.interaction.start, anchor]);
      this.ctx.chart.emit("drawing-change", {
        drawing: this.interaction.drawing
      });
      this.ctx.requestRedraw("drawings");
      return;
    }

    const delta = {
      index: anchor.index - this.interaction.start.index,
      price: anchor.price - this.interaction.start.price
    };
    this.interaction.drawing.setAnchors(
      this.interaction.anchors.map((originalAnchor) => ({
        index: originalAnchor.index + delta.index,
        price: originalAnchor.price + delta.price
      }))
    );
    this.ctx.chart.emit("drawing-change", {
      drawing: this.interaction.drawing
    });
    this.ctx.requestRedraw("drawings");
  }

  private pointerUp() {
    if (!this.interaction) return;

    if (this.interaction.type === "creating") {
      this.ctx.chart.emit("drawing-create", {
        drawing: this.interaction.drawing
      });
    }
    this.interaction = undefined;
  }

  private toPanePoint(event: ChartPointerEvent): DrawingPoint {
    const region = event.pane.getRegion();
    return {
      x: event.x - region.x,
      y: event.y - region.y
    };
  }

  private getPane(paneId: number) {
    return this.ctx.getPanes().find((pane) => pane.getId() === paneId);
  }
}
