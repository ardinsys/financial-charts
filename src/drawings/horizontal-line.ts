import {
  Drawing,
  type DrawingAnchor,
  type DrawingAnchorHandle,
  type DrawingHitTestContext,
  type DrawingJSON,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext
} from "./drawing";

export interface HorizontalLineOptions extends DrawingOptions {
  color?: string;
  lineWidth?: number;
  selectedColor?: string;
}

interface HorizontalLineJSONData {
  color: string;
  lineWidth: number;
  selectedColor: string;
}

export class HorizontalLine extends Drawing {
  static readonly type = "horizontal-line";
  readonly type = HorizontalLine.type;

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

  static fromJSON(json: DrawingJSON): HorizontalLine {
    const data = json.data as Partial<HorizontalLineJSONData> | undefined;

    return new HorizontalLine({
      anchors: json.anchors,
      id: json.id,
      paneId: json.paneId,
      color: data?.color,
      lineWidth: data?.lineWidth,
      selectedColor: data?.selectedColor
    });
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

  getAnchorHandles(context: DrawingRenderContext): DrawingAnchorHandle[] {
    const anchors = this.getAnchors();
    const index = Math.max(0, anchors.length - 1);
    const anchor = anchors[index] ?? { index: 0, price: 0 };

    return [
      {
        index,
        point: this.projectAnchor(anchor, context)
      }
    ];
  }

  private getLineAnchor(): DrawingAnchor {
    const anchors = this.getAnchors();
    return anchors.at(-1) ?? { index: 0, price: 0 };
  }

  protected getDataJSON(): HorizontalLineJSONData {
    return {
      color: this.color,
      lineWidth: this.lineWidth,
      selectedColor: this.selectedColor
    };
  }
}
