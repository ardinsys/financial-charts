import { OHLCController } from "./controller";

export class BarController extends OHLCController {
  static ID = "bar";

  private spacing = 0.1;

  draw(): void {
    const ctx = this.chart.getContext("main");
    const pixelPerMs = this.chart.getPixelPerMs();
    const visibleDataPoints = this.chart.getLastVisibleDataPoints();

    const barSpacing = this.options.stepSize * pixelPerMs * this.spacing;
    const barWidth = this.options.stepSize * pixelPerMs - barSpacing;

    ctx.lineWidth = Math.min(1, barWidth / 5);

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
