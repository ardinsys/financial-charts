import type { Pane } from "../panes/pane";

export interface DrawingAnchor {
  index: number;
  price: number;
}

export interface DrawingPoint {
  x: number;
  y: number;
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

let drawingId = 0;

export abstract class Drawing {
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

  return {
    index: timeScale.unprojectIndex(point.x, {
      canvas,
      devicePixelRatio: 1,
      barAlignment: "center"
    }),
    price: pane.getPriceScale().unproject(point.y, {
      canvas,
      devicePixelRatio: 1
    })
  };
}
