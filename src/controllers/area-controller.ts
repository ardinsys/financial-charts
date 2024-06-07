import { SimpleController } from "./controller";

export class AreaController extends SimpleController {
  static ID = "area";

  draw(): void {
    const ctx = this.chart.getContext("main");

    const visibleDataPoints = this.chart.getLastVisibleDataPoints();

    ctx.lineWidth = this.options.theme.area.width;
    const linePath = new Path2D();
    ctx.strokeStyle = this.options.theme.area.color;
    ctx.lineWidth = this.options.theme.area.width;
    let firstPoint = true;
    let firstX = 0,
      lastX = 0;

    const timeRange = this.chart.getTimeRange();
    const visibleExtent = this.chart.getVisibleExtent();

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];
      if (point.time < timeRange.start) continue;
      if (point.time > timeRange.end) break;

      if (point.close == undefined) continue;

      const { x, y } = visibleExtent.mapToPixel(point.time, point.close!);

      if (firstPoint) {
        linePath.moveTo(x, y);
        firstPoint = false;
        firstX = x; // Remember the first point to close the path later
      } else {
        linePath.lineTo(x, y);
      }
      lastX = x; // Remember the last point to close the path later
    }

    ctx.stroke(linePath);

    const sizes = this.chart.getLogicalCanvas("main");

    ctx.strokeStyle = "transparent";
    ctx.lineWidth = 0;
    linePath.lineTo(lastX, sizes.height); // Down to the bottom of the chart
    linePath.lineTo(firstX, sizes.height); // Line to the start along the bottom
    linePath.closePath();

    if (typeof this.options.theme.area.fill === "string") {
      ctx.fillStyle = this.options.theme.area.fill;
    } else {
      const gradient = ctx.createLinearGradient(0, 0, 0, sizes.height);
      for (const stop of this.options.theme.area.fill) {
        gradient.addColorStop(stop[0], stop[1]);
      }
      ctx.fillStyle = gradient;
    }
    ctx.fill(linePath);
  }
}
