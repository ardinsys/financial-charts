import { OHLCController } from "./controller";

export class HollowCandleController extends OHLCController {
  static ID = "hollow-candle";

  private spacing = 0.3;

  draw(): void {
    const {
      canvasContext: ctx,
      pixelsPerBar,
      visibleData,
      visibleStartIndex,
      projectIndex,
      projectPrice,
    } = this.context.getDrawingContext();

    const candleSpacing = pixelsPerBar * this.spacing;
    const candleWidth = pixelsPerBar - candleSpacing;
    const upWicks = new Path2D();
    const downWicks = new Path2D();
    const upBodies = new Path2D();
    const downBodies = new Path2D();

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

      const isHollow = point.close! > point.open!;
      const wickX = x + (candleWidth / 2 + candleSpacing / 2);
      const topWickY = Math.min(open, close);
      const bottomWickY = Math.max(open, close);
      const bodyHeight = Math.max(1, bottomWickY - topWickY);
      const bodyTop = open === close ? topWickY - bodyHeight / 2 : topWickY;
      const wickPath = isHollow ? upWicks : downWicks;
      const bodyPath = isHollow ? upBodies : downBodies;

      wickPath.moveTo(wickX, high);
      wickPath.lineTo(wickX, topWickY);
      wickPath.moveTo(wickX, low);
      wickPath.lineTo(wickX, bottomWickY);
      bodyPath.rect(x + candleSpacing / 2, bodyTop, candleWidth, bodyHeight);
    }

    ctx.strokeStyle = this.options.theme.candle.upWickColor;
    ctx.stroke(upWicks);
    ctx.strokeStyle = this.options.theme.candle.downWickColor;
    ctx.stroke(downWicks);
    ctx.strokeStyle = this.options.theme.candle.upColor;
    ctx.stroke(upBodies);
    ctx.fillStyle = this.options.theme.candle.downColor;
    ctx.fill(downBodies);
  }
}
