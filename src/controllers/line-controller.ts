import { SimpleController } from "./controller";

export class LineController extends SimpleController {
  static ID = "line";

  draw(): void {
    const {
      canvasContext: ctx,
      visibleData,
      projectTime,
      projectPrice
    } = this.context.getDrawingContext();

    ctx.fillStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;
    ctx.beginPath();
    ctx.strokeStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;
    let firstPoint = true;

    for (let i = 0; i < visibleData.length; i++) {
      const point = visibleData[i];

      if (point.close == undefined) continue;

      const x = projectTime(point.time);
      const y = projectPrice(point.close!);

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
