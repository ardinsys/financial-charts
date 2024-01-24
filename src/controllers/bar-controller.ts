import { OHLCController } from "./controller";

export class BarController extends OHLCController {
  static ID = "bar";

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

    const barSpacing = this.options.stepSize * pixelPerMs * this.spacing;
    const barWidth = this.options.stepSize * pixelPerMs - barSpacing;

    ctx.lineWidth = Math.min(1, barWidth / 5);

    const timeRange = this.chart.getTimeRange();
    const visibleExtent = this.chart.getVisibleExtent();
    const zoomLevel = this.chart.getZoomLevel();
    const panOffset = this.chart.getPanOffset();

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];
      if (point.time < timeRange.start) continue;
      if (point.time > timeRange.end) break;

      const x = visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        zoomLevel,
        panOffset
      ).x;

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

      const centralX = x + (barWidth / 2 + barSpacing / 2);

      // Draw the high-low line
      ctx.beginPath();
      ctx.strokeStyle =
        point.close! > point.open!
          ? this.options.theme.bar.upColor
          : this.options.theme.bar.downColor;
      ctx.moveTo(centralX, high);
      ctx.lineTo(centralX, low);
      ctx.stroke();

      // Draw the open tick (left side)
      ctx.beginPath();
      ctx.moveTo(centralX - Math.max(barWidth / 2, 4), open);
      ctx.lineTo(centralX, open);
      ctx.stroke();

      // Draw the close tick (right side)
      ctx.beginPath();
      ctx.moveTo(centralX, close);
      ctx.lineTo(centralX + Math.max(barWidth / 2, 4), close);
      ctx.stroke();
    }
  }
}
