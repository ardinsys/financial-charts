import {
  Drawing,
  drawAnchorHandle,
  type DrawingAnchor,
  type DrawingAnchorHandle,
  type DrawingHitTestContext,
  type DrawingJSON,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext
} from "./drawing";

export interface RectangleDrawingOptions extends DrawingOptions {
  fillColor?: string;
  lineWidth?: number;
  selectedColor?: string;
  strokeColor?: string;
}

interface RectangleDrawingJSONData {
  fillColor: string;
  lineWidth: number;
  selectedColor?: string;
  strokeColor: string;
}

export class RectangleDrawing extends Drawing {
  static readonly type = "rectangle";
  readonly type = RectangleDrawing.type;

  private fillColor: string;
  private lineWidth: number;
  private selectedColor?: string;
  private strokeColor: string;

  constructor({
    fillColor = "rgba(37, 99, 235, 0.12)",
    lineWidth = 2,
    selectedColor,
    strokeColor = "#2563eb",
    ...options
  }: RectangleDrawingOptions) {
    super(options);
    this.fillColor = fillColor;
    this.lineWidth = lineWidth;
    this.selectedColor = selectedColor;
    this.strokeColor = strokeColor;
  }

  static fromJSON(json: DrawingJSON): RectangleDrawing {
    const data = json.data as Partial<RectangleDrawingJSONData> | undefined;

    return new RectangleDrawing({
      anchors: json.anchors,
      id: json.id,
      paneId: json.paneId,
      fillColor: data?.fillColor,
      lineWidth: data?.lineWidth,
      selectedColor: data?.selectedColor,
      strokeColor: data?.strokeColor
    });
  }

  draw(ctx: CanvasRenderingContext2D, context: DrawingRenderContext) {
    const bounds = this.getBounds(context);
    if (!bounds) return;

    ctx.save();
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.strokeColor;
    ctx.fillStyle = this.fillColor;
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.fill();
    ctx.stroke();

    if (this.isSelected()) {
      for (const handle of this.getAnchorHandles(context)) {
        drawAnchorHandle(
          ctx,
          handle.point,
          context.handleTheme,
          this.selectedColor
        );
      }
    }
    ctx.restore();
  }

  hitTest(point: DrawingPoint, context: DrawingHitTestContext) {
    const bounds = this.getBounds(context);
    if (!bounds) return false;

    const { tolerance } = context;
    const insideExpandedBounds =
      point.x >= bounds.x - tolerance &&
      point.x <= bounds.x + bounds.width + tolerance &&
      point.y >= bounds.y - tolerance &&
      point.y <= bounds.y + bounds.height + tolerance;
    return insideExpandedBounds;
  }

  protected getDataJSON(): RectangleDrawingJSONData {
    return {
      fillColor: this.fillColor,
      lineWidth: this.lineWidth,
      ...(this.selectedColor ? { selectedColor: this.selectedColor } : {}),
      strokeColor: this.strokeColor
    };
  }

  getAnchorHandles(context: DrawingRenderContext): DrawingAnchorHandle[] {
    const [start, end] = this.projectAnchors(context);
    if (!start || !end) return [];

    return [
      { index: 0, point: start },
      { index: 1, point: { x: end.x, y: start.y } },
      { index: 2, point: end },
      { index: 3, point: { x: start.x, y: end.y } }
    ];
  }

  moveAnchor(index: number, anchor: DrawingAnchor): void {
    const [start, end] = this.getAnchors();
    if (!start || !end) return;

    if (index === 0) {
      this.setAnchors([anchor, end]);
    } else if (index === 1) {
      this.setAnchors([
        { ...start, price: anchor.price },
        { ...end, index: anchor.index }
      ]);
    } else if (index === 2) {
      this.setAnchors([start, anchor]);
    } else if (index === 3) {
      this.setAnchors([
        { ...start, index: anchor.index },
        { ...end, price: anchor.price }
      ]);
    }
  }

  private getBounds(context: DrawingRenderContext) {
    const [start, end] = this.projectAnchors(context);
    if (!start || !end) return undefined;

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);

    return {
      x,
      y,
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    };
  }
}
