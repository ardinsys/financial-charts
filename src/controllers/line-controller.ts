import { SimpleController } from "./controller";

export class LineController extends SimpleController {
  static ID = "line";

  draw(): void {
    const ctx = this.chart.getContext("main");

    const visibleDataPoints = this.chart.recalculateVisibleExtent();

    ctx.fillStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;
    ctx.beginPath();
    ctx.strokeStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;
    let firstPoint = true;

    const visibleExtent = this.chart.getVisibleExtent();

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];

      if (point.close == undefined) continue;

      const { x, y } = visibleExtent.mapToPixel(point.time, point.close!);

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }
}
