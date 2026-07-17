import { SimpleController } from "./controller";

export class AreaController extends SimpleController {
  static ID = "area";
  private gradient?: CanvasGradient;
  private gradientContext?: CanvasRenderingContext2D;
  private gradientHeight?: number;
  private gradientStops?: readonly (readonly [number, string])[];

  draw(): void {
    const {
      canvasContext: ctx,
      logicalSize,
      visibleData,
      visibleStartIndex,
      timeRange,
      projectIndex,
      projectPrice
    } = this.context.getDrawingContext();

    ctx.lineWidth = this.options.theme.area.width;
    const linePath = new Path2D();
    ctx.strokeStyle = this.options.theme.area.color;
    ctx.lineWidth = this.options.theme.area.width;
    let firstPoint = true;
    let firstX = 0,
      lastX = 0;

    for (let i = 0; i < visibleData.length; i++) {
      const point = visibleData[i];
      if (point.time < timeRange.start) continue;
      if (point.time > timeRange.end) break;

      if (point.close == undefined) continue;

      const x = projectIndex(visibleStartIndex + i);
      const y = projectPrice(point.close!);

      if (firstPoint) {
        linePath.moveTo(x, y);
        firstPoint = false;
        firstX = x;
      } else {
        linePath.lineTo(x, y);
      }
      lastX = x;
    }

    ctx.stroke(linePath);

    ctx.strokeStyle = "transparent";
    ctx.lineWidth = 0;
    linePath.lineTo(lastX, logicalSize.height);
    linePath.lineTo(firstX, logicalSize.height);
    linePath.closePath();

    if (typeof this.options.theme.area.fill === "string") {
      ctx.fillStyle = this.options.theme.area.fill;
    } else {
      ctx.fillStyle = this.getGradient(
        ctx,
        logicalSize.height,
        this.options.theme.area.fill
      );
    }
    ctx.fill(linePath);
  }

  private getGradient(
    ctx: CanvasRenderingContext2D,
    height: number,
    stops: readonly (readonly [number, string])[]
  ): CanvasGradient {
    if (
      this.gradient &&
      this.gradientContext === ctx &&
      this.gradientHeight === height &&
      this.gradientStops === stops
    ) {
      return this.gradient;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    this.gradient = gradient;
    this.gradientContext = ctx;
    this.gradientHeight = height;
    this.gradientStops = stops;
    return gradient;
  }
}
