import { OHLCController } from "./controller";

export class CandlestickController extends OHLCController {
  static ID = "candle";

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

    const candleSpacing = pixelsPerBar * this.spacing;
    const candleWidth = pixelsPerBar - candleSpacing;
    const upPath = new Path2D();
    const downPath = new Path2D();

    ctx.lineWidth = Math.min(1, candleWidth / 5);

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
      const path = point.close! > point.open! ? upPath : downPath;
      const wickX = x + candleWidth / 2 + candleSpacing / 2;
      const bodyHeight = Math.max(1, Math.abs(open - close));
      const bodyTop =
        open === close ? open - bodyHeight / 2 : Math.min(open, close);

      path.moveTo(wickX, high);
      path.lineTo(wickX, low);
      path.rect(
        x + candleSpacing / 2,
        bodyTop,
        candleWidth,
        bodyHeight
      );
    }

    this.drawPath(ctx, upPath, this.options.theme.candle.upColor);
    this.drawPath(ctx, downPath, this.options.theme.candle.downColor);
  }

  private drawPath(ctx: CanvasRenderingContext2D, path: Path2D, color: string) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.fill(path);
    ctx.stroke(path);
  }
}
