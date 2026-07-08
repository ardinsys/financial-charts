import {
  Drawing,
  type DrawingHitTestContext,
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

export class RectangleDrawing extends Drawing {
  private fillColor: string;
  private lineWidth: number;
  private selectedColor: string;
  private strokeColor: string;

  constructor({
    fillColor = "rgba(37, 99, 235, 0.12)",
    lineWidth = 2,
    selectedColor = "#f59e0b",
    strokeColor = "#2563eb",
    ...options
  }: RectangleDrawingOptions) {
    super(options);
    this.fillColor = fillColor;
    this.lineWidth = lineWidth;
    this.selectedColor = selectedColor;
    this.strokeColor = strokeColor;
  }

  draw(ctx: CanvasRenderingContext2D, context: DrawingRenderContext) {
    const bounds = this.getBounds(context);
    if (!bounds) return;

    ctx.save();
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.isSelected() ? this.selectedColor : this.strokeColor;
    ctx.fillStyle = this.fillColor;
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.fill();
    ctx.stroke();

    if (this.isSelected()) {
      for (const point of boundsToCorners(bounds)) {
        drawAnchorHandle(ctx, point, this.selectedColor);
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
    if (!insideExpandedBounds) return false;

    const nearVerticalEdge =
      Math.abs(point.x - bounds.x) <= tolerance ||
      Math.abs(point.x - (bounds.x + bounds.width)) <= tolerance;
    const nearHorizontalEdge =
      Math.abs(point.y - bounds.y) <= tolerance ||
      Math.abs(point.y - (bounds.y + bounds.height)) <= tolerance;

    return nearVerticalEdge || nearHorizontalEdge;
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

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boundsToCorners(bounds: Bounds): DrawingPoint[] {
  return [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height }
  ];
}

function drawAnchorHandle(
  ctx: CanvasRenderingContext2D,
  point: DrawingPoint,
  color: string
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
  ctx.fill();
}
