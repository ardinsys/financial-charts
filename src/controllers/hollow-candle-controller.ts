import { OHLCController } from "./controller";

export class HollowCandleController extends OHLCController {
  static ID = "hollow-candle";

  private spacing = 0.3;

  draw(): void {
    const ctx = this.chart.getContext("main");
    const pixelsPerBar = this.chart.getPixelsPerBar();
    const visibleDataPoints = this.chart.getLastVisibleDataPoints();

    const candleSpacing = pixelsPerBar * this.spacing;
    const candleWidth = pixelsPerBar - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

    const timeScale = this.chart.getTimeScale();
    const priceScale = this.chart.getPriceScale();
    const scaleOptions = {
      canvas: ctx.canvas
    };

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];

      if (point.close == undefined) continue;
      if (point.open == undefined) continue;
      if (point.high == undefined) continue;
      if (point.low == undefined) continue;

      const x = timeScale.project(point.time, scaleOptions);
      const high = priceScale.project(point.high!, scaleOptions);
      const low = priceScale.project(point.low!, scaleOptions);
      const open = priceScale.project(point.open!, scaleOptions);
      const close = priceScale.project(point.close!, scaleOptions);

      // Determine if the candle is hollow or filled
      const isHollow = point.close! > point.open!;
      const bodyColor = isHollow
        ? this.options.theme.candle.upColor
        : this.options.theme.candle.downColor;

      const wickX = x + (candleWidth / 2 + candleSpacing / 2);
      const topWickY = Math.min(open, close);
      const bottomWickY = Math.max(open, close);

      // Draw the high-low line
      ctx.beginPath();
      ctx.strokeStyle = isHollow
        ? this.options.theme.candle.upWickColor
        : this.options.theme.candle.downWickColor; // Use a wick color for the line

      ctx.moveTo(wickX, high);
      ctx.lineTo(wickX, topWickY);
      ctx.moveTo(wickX, low);
      ctx.lineTo(wickX, bottomWickY);
      ctx.stroke();

      // Draw the open-close box
      ctx.beginPath();
      if (isHollow) {
        // Hollow candle (stroke only)
        ctx.strokeStyle = bodyColor;
        ctx.rect(
          x + candleSpacing / 2,
          topWickY,
          candleWidth,
          bottomWickY - topWickY
        );
        ctx.stroke();
      } else {
        // Filled candle (filled rectangle)
        ctx.fillStyle = bodyColor;
        ctx.rect(
          x + candleSpacing / 2,
          topWickY,
          candleWidth,
          bottomWickY - topWickY
        );
        ctx.fill();
      }
    }
  }
}
