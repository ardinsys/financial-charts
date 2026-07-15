import { OHLCController } from "./controller";

export class HollowCandleController extends OHLCController {
  static ID = "hollow-candle";

  private spacing = 0.3;

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

      const isHollow = point.close! > point.open!;
      const bodyColor = isHollow
        ? this.options.theme.candle.upColor
        : this.options.theme.candle.downColor;

      const wickX = x + (candleWidth / 2 + candleSpacing / 2);
      const topWickY = Math.min(open, close);
      const bottomWickY = Math.max(open, close);

      ctx.beginPath();
      ctx.strokeStyle = isHollow
        ? this.options.theme.candle.upWickColor
        : this.options.theme.candle.downWickColor;

      ctx.moveTo(wickX, high);
      ctx.lineTo(wickX, topWickY);
      ctx.moveTo(wickX, low);
      ctx.lineTo(wickX, bottomWickY);
      ctx.stroke();

      ctx.beginPath();
      if (isHollow) {
        ctx.strokeStyle = bodyColor;
        ctx.rect(
          x + candleSpacing / 2,
          topWickY,
          candleWidth,
          bottomWickY - topWickY
        );
        ctx.stroke();
      } else {
        ctx.fillStyle = bodyColor;
        ctx.rect(
          x + candleSpacing / 2,
          topWickY,
          candleWidth,
          bottomWickY - topWickY
        );
        ctx.fill();
      }
    }
  }
}
