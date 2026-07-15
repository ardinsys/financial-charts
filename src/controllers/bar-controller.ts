import { OHLCController } from "./controller";

export class BarController extends OHLCController {
  static ID = "bar";

  private spacing = 0.1;

  draw(): void {
    const {
      canvasContext: ctx,
      pixelsPerBar,
      visibleData,
      projectTime,
      projectPrice
    } = this.context.getDrawingContext();

    const barSpacing = pixelsPerBar * this.spacing;
    const barWidth = pixelsPerBar - barSpacing;

    ctx.lineWidth = Math.min(1, barWidth / 5);

    for (let i = 0; i < visibleData.length; i++) {
      const point = visibleData[i];

      if (point.close == undefined) continue;
      if (point.open == undefined) continue;
      if (point.high == undefined) continue;
      if (point.low == undefined) continue;

      const x = projectTime(point.time);
      const high = projectPrice(point.high!);
      const low = projectPrice(point.low!);
      const open = projectPrice(point.open!);
      const close = projectPrice(point.close!);

      const centralX = x + (barWidth / 2 + barSpacing / 2);

      ctx.beginPath();
      ctx.strokeStyle =
        point.close! > point.open!
          ? this.options.theme.bar.upColor
          : this.options.theme.bar.downColor;
      ctx.moveTo(centralX, high);
      ctx.lineTo(centralX, low);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centralX - Math.max(barWidth / 2, 4), open);
      ctx.lineTo(centralX, open);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centralX, close);
      ctx.lineTo(centralX + Math.max(barWidth / 2, 4), close);
      ctx.stroke();
    }
  }
}
