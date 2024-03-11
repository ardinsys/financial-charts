import { OHLCController } from "./controller";

export class HollowCandleController extends OHLCController {
  static ID = "hollow-candle";

  private spacing = 0.3;

  draw(): void {
    const ctx = this.chart.getContext("main");
    const pixelPerMs = this.chart.getPixelPerMs();
    const visibleDataPoints = this.chart.recalculateVisibleExtent();

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

      if (point.close == undefined) continue;
      if (point.open == undefined) continue;
      if (point.high == undefined) continue;
      if (point.low == undefined) continue;

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
