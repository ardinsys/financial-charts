import { OHLCController } from "./controller";

export class CandlestickController extends OHLCController {
  static ID = "candle";

  private spacing = 0.1;

  draw(): void {
    const ctx = this.chart.getContext("main");
    const pixelPerMs = this.chart.getPixelPerMs();
    const visibleDataPoints = this.chart.getLastVisibleDataPoints();

    const candleSpacing = this.options.stepSize * pixelPerMs * this.spacing;
    const candleWidth = this.options.stepSize * pixelPerMs - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

    const visibleExtent = this.chart.getVisibleExtent();

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];

      if (point.close == undefined) continue;
      if (point.open == undefined) continue;
      if (point.high == undefined) continue;
      if (point.low == undefined) continue;

      const { x } = visibleExtent.mapToPixel(point.time, point.close!);

      const high = visibleExtent.mapToPixel(point.time, point.high!).y;
      const low = visibleExtent.mapToPixel(point.time, point.low!).y;
      const open = visibleExtent.mapToPixel(point.time, point.open!).y;
      const close = visibleExtent.mapToPixel(point.time, point.close!).y;

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
