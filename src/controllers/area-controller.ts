import { SimpleController } from "./controller";

export class AreaController extends SimpleController {
  static ID = "area";

  draw(): void {
    const {
      canvasContext: ctx,
      logicalSize,
      visibleData,
      timeRange,
      projectTime,
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

      const x = projectTime(point.time);
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
      const gradient = ctx.createLinearGradient(0, 0, 0, logicalSize.height);
      for (const stop of this.options.theme.area.fill) {
        gradient.addColorStop(stop[0], stop[1]);
      }
      ctx.fillStyle = gradient;
    }
    ctx.fill(linePath);
  }
}
