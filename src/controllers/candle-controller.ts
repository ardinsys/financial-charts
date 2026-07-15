import { OHLCController } from "./controller";

export class CandlestickController extends OHLCController {
  static ID = "candle";

  private spacing = 0.1;

  draw(): void {
    const {
      canvasContext: ctx,
      pixelsPerBar,
      visibleData,
      projectTime,
      projectPrice
    } = this.context.getDrawingContext();

    const candleSpacing = pixelsPerBar * this.spacing;
    const candleWidth = pixelsPerBar - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

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

      ctx.beginPath();
      ctx.strokeStyle =
        point.close! > point.open!
          ? this.options.theme.candle.upColor
          : this.options.theme.candle.downColor;
      ctx.moveTo(x + (candleWidth / 2 + candleSpacing / 2), high);
      ctx.lineTo(x + (candleWidth / 2 + candleSpacing / 2), low);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle =
        point.close! > point.open!
          ? this.options.theme.candle.upColor
          : this.options.theme.candle.downColor;
      ctx.rect(
        x + candleSpacing / 2,
        Math.min(open, close),
        candleWidth,
        Math.abs(open - close)
      );
      ctx.fill();
    }
  }
}
