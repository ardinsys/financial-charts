import { BaseChartOptions, ChartController, DeepConcrete } from "../controller";
import { DataExtent } from "../../extents/data-extent";
import { ChartData, TimeRange } from "../types";
import { ComplexDataExtent } from "../../extents/complex-data-extent";

export interface CandlestickChartOptions extends BaseChartOptions {}

export class CandlestickController extends ChartController<CandlestickChartOptions> {
  private spacing = 0.1;

  protected createDataExtent(
    data: ChartData[],
    timeRange: TimeRange
  ): DataExtent {
    return new ComplexDataExtent(data, timeRange);
  }

  constructor(
    container: HTMLElement,
    timeRange: TimeRange,
    options: CandlestickChartOptions
  ) {
    super(
      container,
      timeRange,
      options as DeepConcrete<CandlestickChartOptions>
    );
  }

  protected getXLabelOffset(): number {
    return this.options.stepSize / 2;
  }

  protected getTimeFromRawDataPoint(rawPoint: ChartData): number {
    return rawPoint.time - (rawPoint.time % this.options.stepSize);
  }

  protected drawChart(): void {
    const ctx = this.getContext("main");
    const pixelPerMs = this.getPixelPerMs();
    const visibleDataPoints = this.recalculateVisibleExtent();

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = this.options.theme.backgroundColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawYAxis();
    this.drawXAxis();

    const candleSpacing = this.options.stepSize * pixelPerMs * this.spacing;
    const candleWidth = this.options.stepSize * pixelPerMs - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];
      if (point.time < this.timeRange.start) continue;
      if (point.time > this.timeRange.end) break;

      const { x } = this.visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      );

      const high = this.visibleExtent.mapToPixel(
        point.time,
        point.high!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      ).y;

      const low = this.visibleExtent.mapToPixel(
        point.time,
        point.low!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      ).y;

      const open = this.visibleExtent.mapToPixel(
        point.time,
        point.open!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      ).y;

      const close = this.visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      ).y;

      // Draw the high-low line
      ctx.beginPath();
      ctx.strokeStyle =
        point.close! > point.open!
          ? this.options.theme.candle.upColor
          : this.options.theme.candle.downColor;
      ctx.moveTo(x + (candleWidth / 2 + candleSpacing / 2), high);
      ctx.lineTo(x + (candleWidth / 2 + candleSpacing / 2), low);
      ctx.stroke();

      // Draw the open-close box
      ctx.beginPath();
      ctx.fillStyle =
        point.close! > point.open!
          ? this.options.theme.candle.upColor
          : this.options.theme.candle.downColor;
      ctx.rect(
        x + candleSpacing / 2,
        Math.min(open, close),
        candleWidth,
        Math.abs(open - close)
      );
      ctx.fill();
    }
  }
}
