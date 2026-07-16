import type { Pane } from "../panes/pane";

export interface DrawingAnchor {
  readonly index: number;
  readonly price: number;
}

export interface DrawingPoint {
  readonly x: number;
  readonly y: number;
}

export interface DrawingAnchorHandle {
  readonly index: number;
  readonly point: DrawingPoint;
}

export interface DrawingAxisBounds {
  readonly x?: readonly DrawingAnchor[];
  readonly y?: readonly DrawingAnchor[];
}

export interface DrawingRenderContext {
  /** Target pane; projected drawing points use chart-local logical pixels. */
  readonly pane: Pane;
  /** Physical backing canvas for the shared drawings layer. */
  readonly canvas: HTMLCanvasElement;
}

export interface DrawingHitTestContext extends DrawingRenderContext {
  readonly tolerance: number;
}

export interface DrawingOptions {
  readonly anchors: readonly DrawingAnchor[];
  readonly id?: string;
  readonly paneId?: number;
}

export interface DrawingJSON<
  TType extends string = string,
  TData extends object = object
> {
  readonly anchors: readonly DrawingAnchor[];
  readonly data?: TData;
  readonly id: string;
  readonly paneId: number;
  readonly type: TType;
}

let drawingId = 0;

export abstract class Drawing {
  /** Stable serialization key handled by a registered deserializer. */
  abstract readonly type: string;
  readonly id: string;
  private anchors: readonly DrawingAnchor[];
  private paneId: number;
  private selected = false;

  constructor({ anchors, id, paneId = 0 }: DrawingOptions) {
    this.id = validateDrawingId(id ?? `drawing-${++drawingId}`);
    this.anchors = copyDrawingAnchors(anchors);
    this.paneId = validatePaneId(paneId);
  }

  getPaneId() {
    return this.paneId;
  }

  setPaneId(paneId: number) {
    this.paneId = validatePaneId(paneId);
  }

  getAnchors(): readonly DrawingAnchor[] {
    return this.anchors;
  }

  setAnchors(anchors: readonly DrawingAnchor[]) {
    this.anchors = copyDrawingAnchors(anchors);
  }

  isSelected() {
    return this.selected;
  }

  setSelected(selected: boolean) {
    this.selected = selected;
  }

  moveBy(delta: DrawingAnchor) {
    this.anchors = this.anchors.map((anchor) => ({
      index: anchor.index + delta.index,
      price: anchor.price + delta.price
    }));
  }

  getAnchorHandles(context: DrawingRenderContext): DrawingAnchorHandle[] {
    return this.projectAnchors(context).map((point, index) => ({
      index,
      point
    }));
  }

  getAxisBounds(context: DrawingRenderContext): DrawingAxisBounds {
    const anchors = this.getAnchorHandles(context).map((handle) =>
      this.unprojectPoint(handle.point, context)
    );

    return {
      x: anchors,
      y: anchors
    };
  }

  hitTestAnchor(
    point: DrawingPoint,
    context: DrawingHitTestContext
  ): number | undefined {
    let closest: { distance: number; index: number } | undefined;

    for (const handle of this.getAnchorHandles(context)) {
      const distance = Math.hypot(
        point.x - handle.point.x,
        point.y - handle.point.y
      );
      if (distance > context.tolerance) continue;
      if (!closest || distance < closest.distance) {
        closest = { distance, index: handle.index };
      }
    }

    return closest?.index;
  }

  moveAnchor(index: number, anchor: DrawingAnchor): void {
    if (!this.anchors[index]) return;

    const anchors = [...this.anchors];
    anchors[index] = anchor;
    this.setAnchors(anchors);
  }

  toJSON(): DrawingJSON {
    const data = this.getDataJSON();
    return {
      anchors: copyDrawingAnchors(this.anchors),
      id: this.id,
      paneId: this.paneId,
      type: this.type,
      ...(data === undefined ? {} : { data })
    };
  }

  /** Returns an owned JSON-safe snapshot of subclass state. */
  protected getDataJSON(): object | undefined {
    return undefined;
  }

  protected projectAnchor(
    anchor: DrawingAnchor,
    { pane }: DrawingRenderContext
  ): DrawingPoint {
    const timeScale = pane.getTimeScale();
    if (!timeScale) {
      return { x: 0, y: 0 };
    }

    const region = pane.getRegion();
    const scaleOptions = {
      canvas: { width: region.width, height: region.height },
      devicePixelRatio: 1,
      barAlignment: pane.getTimeAnchorAlignment()
    };

    return {
      x: region.x + timeScale.projectIndex(anchor.index, scaleOptions),
      y: region.y + pane.getPriceScale().project(anchor.price, scaleOptions)
    };
  }

  protected projectAnchors(context: DrawingRenderContext) {
    return this.anchors.map((anchor) => this.projectAnchor(anchor, context));
  }

  protected unprojectPoint(
    point: DrawingPoint,
    { pane }: DrawingRenderContext
  ): DrawingAnchor {
    const timeScale = pane.getTimeScale();
    if (!timeScale) {
      return { index: 0, price: 0 };
    }

    const region = pane.getRegion();
    const scaleOptions = {
      canvas: { width: region.width, height: region.height },
      devicePixelRatio: 1,
      barAlignment: pane.getTimeAnchorAlignment()
    };

    return {
      index: Math.round(
        timeScale.unprojectIndex(point.x - region.x, scaleOptions)
      ),
      price: pane.getPriceScale().unproject(point.y - region.y, scaleOptions)
    };
  }

  abstract draw(
    ctx: CanvasRenderingContext2D,
    context: DrawingRenderContext
  ): void;

  abstract hitTest(
    point: DrawingPoint,
    context: DrawingHitTestContext
  ): boolean;
}

export function drawAnchorHandle(
  ctx: CanvasRenderingContext2D,
  point: DrawingPoint,
  color = "#f59e0b"
) {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(19, 23, 34, 0.95)";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function anchorFromPoint(
  point: DrawingPoint,
  pane: Pane
): DrawingAnchor {
  const timeScale = pane.getTimeScale();
  if (!timeScale) {
    return { index: 0, price: 0 };
  }

  const region = pane.getRegion();
  const canvas = {
    width: region.width,
    height: region.height
  };

  const index = timeScale.unprojectIndex(point.x - region.x, {
    canvas,
    devicePixelRatio: 1,
    barAlignment: pane.getTimeAnchorAlignment()
  });

  return {
    index: Math.round(index),
    price: pane.getPriceScale().unproject(point.y - region.y, {
      canvas,
      devicePixelRatio: 1
    })
  };
}

function copyDrawingAnchors(anchors: readonly DrawingAnchor[]) {
  return anchors.map((anchor) => {
    if (!Number.isFinite(anchor.index) || !Number.isFinite(anchor.price)) {
      throw new TypeError(
        "Drawing anchors must contain finite index and price values."
      );
    }
    return { index: anchor.index, price: anchor.price };
  });
}

function validateDrawingId(id: string) {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new TypeError("Drawing id must be a non-empty string.");
  }
  return id;
}

function validatePaneId(paneId: number) {
  if (!Number.isInteger(paneId) || paneId < 0) {
    throw new RangeError("Drawing paneId must be a non-negative integer.");
  }
  return paneId;
}
