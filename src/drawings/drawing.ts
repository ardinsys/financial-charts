import type { Pane } from "../panes/pane";

export interface DrawingAnchor {
  index: number;
  price: number;
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingAnchorHandle {
  index: number;
  point: DrawingPoint;
}

export interface DrawingRenderContext {
  pane: Pane;
  canvas: HTMLCanvasElement;
}

export interface DrawingHitTestContext extends DrawingRenderContext {
  tolerance: number;
}

export interface DrawingOptions {
  anchors: DrawingAnchor[];
  id?: string;
  paneId?: number;
}

export interface DrawingJSON<
  TType extends string = string,
  TData extends object = object
> {
  anchors: DrawingAnchor[];
  data?: TData;
  id: string;
  paneId: number;
  type: TType;
}

let drawingId = 0;

export abstract class Drawing {
  readonly type: string = "drawing";
  readonly id: string;
  private anchors: DrawingAnchor[];
  private paneId: number;
  private selected = false;

  constructor({ anchors, id, paneId = 0 }: DrawingOptions) {
    this.id = id ?? `drawing-${++drawingId}`;
    this.anchors = anchors.map((anchor) => ({ ...anchor }));
    this.paneId = paneId;
  }

  getPaneId() {
    return this.paneId;
  }

  setPaneId(paneId: number) {
    this.paneId = paneId;
  }

  getAnchors() {
    return this.anchors.map((anchor) => ({ ...anchor }));
  }

  setAnchors(anchors: DrawingAnchor[]) {
    this.anchors = anchors.map((anchor) => ({ ...anchor }));
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

    const anchors = this.getAnchors();
    anchors[index] = anchor;
    this.setAnchors(anchors);
  }

  toJSON(): DrawingJSON {
    const json: DrawingJSON = {
      anchors: this.getAnchors(),
      id: this.id,
      paneId: this.paneId,
      type: this.type
    };
    const data = this.getDataJSON();
    if (data !== undefined) {
      json.data = data;
    }

    return json;
  }

  protected getDataJSON(): object | undefined {
    return undefined;
  }

  protected projectAnchor(
    anchor: DrawingAnchor,
    { pane, canvas }: DrawingRenderContext
  ): DrawingPoint {
    const timeScale = pane.getTimeScale();
    if (!timeScale) {
      return { x: 0, y: 0 };
    }

    return {
      x: timeScale.projectIndex(anchor.index, {
        canvas,
        barAlignment: "center"
      }),
      y: pane.getPriceScale().project(anchor.price, { canvas })
    };
  }

  protected projectAnchors(context: DrawingRenderContext) {
    return this.anchors.map((anchor) => this.projectAnchor(anchor, context));
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

  const index = timeScale.unprojectIndex(point.x, {
    canvas,
    devicePixelRatio: 1,
    barAlignment: "center"
  });

  return {
    index: Math.round(index),
    price: pane.getPriceScale().unproject(point.y, {
      canvas,
      devicePixelRatio: 1
    })
  };
}
