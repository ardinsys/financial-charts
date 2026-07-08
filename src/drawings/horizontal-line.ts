import {
  Drawing,
  type DrawingAnchor,
  type DrawingHitTestContext,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext
} from "./drawing";

export interface HorizontalLineOptions extends DrawingOptions {
  color?: string;
  lineWidth?: number;
  selectedColor?: string;
}

export class HorizontalLine extends Drawing {
  private color: string;
  private lineWidth: number;
  private selectedColor: string;

  constructor({
    color = "#0f766e",
    lineWidth = 2,
    selectedColor = "#f59e0b",
    ...options
  }: HorizontalLineOptions) {
    super(options);
    this.color = color;
    this.lineWidth = lineWidth;
    this.selectedColor = selectedColor;
  }

  draw(ctx: CanvasRenderingContext2D, context: DrawingRenderContext) {
    const point = this.projectAnchor(this.getLineAnchor(), context);
    const region = context.pane.getRegion();

    ctx.save();
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.isSelected() ? this.selectedColor : this.color;
    ctx.beginPath();
    ctx.moveTo(region.x, point.y);
    ctx.lineTo(region.x + region.width, point.y);
    ctx.stroke();

    if (this.isSelected()) {
      ctx.fillStyle = this.selectedColor;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  hitTest(point: DrawingPoint, context: DrawingHitTestContext) {
    const anchor = this.projectAnchor(this.getLineAnchor(), context);

    return Math.abs(point.y - anchor.y) <= context.tolerance;
  }

  private getLineAnchor(): DrawingAnchor {
    const anchors = this.getAnchors();
    return anchors.at(-1) ?? { index: 0, price: 0 };
  }
}
