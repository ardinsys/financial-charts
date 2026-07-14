import {
  Drawing,
  DrawingManager,
  type DrawingHitTestContext,
  type DrawingJSON,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext
} from "@ardinsys/financial-charts/extensions";

interface PriceBandData {
  color: string;
  label: string;
}

class PriceBandDrawing extends Drawing {
  static readonly TYPE = "price-band";
  readonly type = PriceBandDrawing.TYPE;

  private color: string;
  private label: string;

  constructor(
    options: DrawingOptions & {
      color?: string;
      label?: string;
    }
  ) {
    super(options);
    this.color = options.color ?? "rgba(37, 99, 235, 0.16)";
    this.label = options.label ?? "Price band";
  }

  static fromJSON(json: DrawingJSON): PriceBandDrawing {
    const data = json.data as Partial<PriceBandData> | undefined;
    return new PriceBandDrawing({
      anchors: json.anchors,
      id: json.id,
      paneId: json.paneId,
      color: data?.color,
      label: data?.label
    });
  }

  draw(ctx: CanvasRenderingContext2D, context: DrawingRenderContext): void {
    const [first, second] = this.projectAnchors(context);
    if (!first || !second) return;

    const y = Math.min(first.y, second.y);
    const height = Math.abs(second.y - first.y);
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.fillRect(0, y, context.pane.getRegion().width, height);
    ctx.fillText(this.label, 8, y + 16);
    ctx.restore();
  }

  hitTest(point: DrawingPoint, context: DrawingHitTestContext): boolean {
    const [first, second] = this.projectAnchors(context);
    if (!first || !second) return false;

    const top = Math.min(first.y, second.y) - context.tolerance;
    const bottom = Math.max(first.y, second.y) + context.tolerance;
    return point.y >= top && point.y <= bottom;
  }

  protected getDataJSON(): PriceBandData {
    return { color: this.color, label: this.label };
  }
}

const manager = new DrawingManager();
const unregister = manager.registerDrawingDeserializer(
  PriceBandDrawing.TYPE,
  PriceBandDrawing.fromJSON
);
const drawing = manager.addDrawing(
  new PriceBandDrawing({
    anchors: [
      { index: 10, price: 100 },
      { index: 20, price: 110 }
    ]
  })
);

manager.getDrawingById(drawing.id);
manager.clearDrawings();
unregister();
