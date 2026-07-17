import { OHLCController } from "./controller";

export class BarController extends OHLCController {
  static ID = "bar";

  private spacing = 0.1;

  draw(): void {
    const {
      canvasContext: ctx,
      pixelsPerBar,
      visibleData,
      visibleStartIndex,
      projectIndex,
      projectPrice
    } = this.context.getDrawingContext();

    const barSpacing = pixelsPerBar * this.spacing;
    const barWidth = pixelsPerBar - barSpacing;
    const upPath = new Path2D();
    const downPath = new Path2D();

    ctx.lineWidth = Math.min(1, barWidth / 5);

    for (let i = 0; i < visibleData.length; i++) {
      const point = visibleData[i];

      if (point.close == undefined) continue;
      if (point.open == undefined) continue;
      if (point.high == undefined) continue;
      if (point.low == undefined) continue;

      const x = projectIndex(visibleStartIndex + i);
      const high = projectPrice(point.high!);
      const low = projectPrice(point.low!);
      const open = projectPrice(point.open!);
      const close = projectPrice(point.close!);

      const centralX = x + (barWidth / 2 + barSpacing / 2);
      const path = point.close! > point.open! ? upPath : downPath;

      path.moveTo(centralX, high);
      path.lineTo(centralX, low);
      path.moveTo(centralX - Math.max(barWidth / 2, 4), open);
      path.lineTo(centralX, open);
      path.moveTo(centralX, close);
      path.lineTo(centralX + Math.max(barWidth / 2, 4), close);
    }

    ctx.strokeStyle = this.options.theme.bar.upColor;
    ctx.stroke(upPath);
    ctx.strokeStyle = this.options.theme.bar.downColor;
    ctx.stroke(downPath);
  }
}
