import { OHLCController } from "./controller";

export class CandlestickController extends OHLCController {
  static ID = "candle";

  private spacing = 0.1;

  draw(): void {
    const ctx = this.chart.getContext("main");
    const pixelPerMs = this.chart.getPixelPerMs();
    const visibleDataPoints = this.chart.recalculateVisibleExtent();

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = this.options.theme.backgroundColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.chart.drawYAxis();
    this.chart.drawXAxis();

    const candleSpacing = this.options.stepSize * pixelPerMs * this.spacing;
    const candleWidth = this.options.stepSize * pixelPerMs - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

    const timeRange = this.chart.getTimeRange();
    const visibleExtent = this.chart.getVisibleExtent();
    const zoomLevel = this.chart.getZoomLevel();
    const panOffset = this.chart.getPanOffset();

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];
      if (point.time < timeRange.start) continue;
      if (point.time > timeRange.end) break;

      const { x } = visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        zoomLevel,
        panOffset
      );

      const high = visibleExtent.mapToPixel(
        point.time,
        point.high!,
        ctx.canvas,
        zoomLevel,
        panOffset
      ).y;

      const low = visibleExtent.mapToPixel(
        point.time,
        point.low!,
        ctx.canvas,
        zoomLevel,
        panOffset
      ).y;

      const open = visibleExtent.mapToPixel(
        point.time,
        point.open!,
        ctx.canvas,
        zoomLevel,
        panOffset
      ).y;

      const close = visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        zoomLevel,
        panOffset
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
