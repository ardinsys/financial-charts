import {
  Drawing,
  type DrawingAnchor,
  type DrawingHitTestContext,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext
} from "./drawing";

export interface TextDrawingOptions extends DrawingOptions {
  backgroundColor?: string;
  color?: string;
  font?: string;
  padding?: number;
  selectedColor?: string;
  text?: string;
}

export class TextDrawing extends Drawing {
  private backgroundColor: string;
  private color: string;
  private font: string;
  private padding: number;
  private selectedColor: string;
  private text: string;

  constructor({
    backgroundColor = "rgba(15, 23, 42, 0.72)",
    color = "#f8fafc",
    font = "13px sans-serif",
    padding = 4,
    selectedColor = "#f59e0b",
    text = "Text",
    ...options
  }: TextDrawingOptions) {
    super(options);
    this.backgroundColor = backgroundColor;
    this.color = color;
    this.font = font;
    this.padding = padding;
    this.selectedColor = selectedColor;
    this.text = text;
  }

  getText() {
    return this.text;
  }

  setText(text: string) {
    this.text = text;
  }

  draw(ctx: CanvasRenderingContext2D, context: DrawingRenderContext) {
    const bounds = this.getBounds(context, ctx);

    ctx.save();
    ctx.font = this.font;
    ctx.textBaseline = "top";
    ctx.fillStyle = this.backgroundColor;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

    if (this.isSelected()) {
      ctx.strokeStyle = this.selectedColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    }

    ctx.fillStyle = this.color;
    ctx.fillText(this.text, bounds.x + this.padding, bounds.y + this.padding);
    ctx.restore();
  }

  hitTest(point: DrawingPoint, context: DrawingHitTestContext) {
    const ctx = context.canvas.getContext("2d");
    if (!ctx) return false;

    const bounds = this.getBounds(context, ctx);

    return (
      point.x >= bounds.x - context.tolerance &&
      point.x <= bounds.x + bounds.width + context.tolerance &&
      point.y >= bounds.y - context.tolerance &&
      point.y <= bounds.y + bounds.height + context.tolerance
    );
  }

  private getBounds(
    context: DrawingRenderContext,
    ctx: CanvasRenderingContext2D
  ) {
    const point = this.projectAnchor(this.getTextAnchor(), context);
    const metrics = this.measure(ctx);

    return {
      x: point.x,
      y: point.y,
      width: metrics.width + this.padding * 2,
      height: metrics.height + this.padding * 2
    };
  }

  private measure(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.font = this.font;
    const metrics = ctx.measureText(this.text);
    ctx.restore();

    return {
      width: Math.max(metrics.width, 1),
      height:
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || 16
    };
  }

  private getTextAnchor(): DrawingAnchor {
    const anchors = this.getAnchors();
    return anchors[0] ?? { index: 0, price: 0 };
  }
}
