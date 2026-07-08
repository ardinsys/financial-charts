import {
  Drawing,
  type DrawingHitTestContext,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext
} from "./drawing";

export interface TrendLineOptions extends DrawingOptions {
  color?: string;
  lineWidth?: number;
  selectedColor?: string;
}

export class TrendLine extends Drawing {
  private color: string;
  private lineWidth: number;
  private selectedColor: string;

  constructor({
    color = "#2563eb",
    lineWidth = 2,
    selectedColor = "#f59e0b",
    ...options
  }: TrendLineOptions) {
    super(options);
    this.color = color;
    this.lineWidth = lineWidth;
    this.selectedColor = selectedColor;
  }

  draw(ctx: CanvasRenderingContext2D, context: DrawingRenderContext) {
    const [start, end] = this.projectAnchors(context);
    if (!start || !end) return;

    ctx.save();
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.isSelected() ? this.selectedColor : this.color;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    if (this.isSelected()) {
      drawAnchorHandle(ctx, start, this.selectedColor);
      drawAnchorHandle(ctx, end, this.selectedColor);
    }
    ctx.restore();
  }

  hitTest(point: DrawingPoint, context: DrawingHitTestContext) {
    const [start, end] = this.projectAnchors(context);
    if (!start || !end) return false;

    return distanceToSegment(point, start, end) <= context.tolerance;
  }
}

function distanceToSegment(
  point: DrawingPoint,
  start: DrawingPoint,
  end: DrawingPoint
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  );

  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
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
