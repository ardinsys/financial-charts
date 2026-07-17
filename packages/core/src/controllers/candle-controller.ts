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
      const isUp = point.close! > point.open!;
      const wickPath = isUp ? upWicks : downWicks;
      const bodyPath = isUp ? upBodies : downBodies;
      const wickX = x + candleWidth / 2 + candleSpacing / 2;
      const bodyHeight = Math.max(1, Math.abs(open - close));
      const bodyTop =
        open === close ? open - bodyHeight / 2 : Math.min(open, close);

      wickPath.moveTo(wickX, high);
      wickPath.lineTo(wickX, low);
      bodyPath.rect(x + candleSpacing / 2, bodyTop, candleWidth, bodyHeight);
    }

    this.drawPaths(ctx, upWicks, upBodies, this.options.theme.candle.upColor);
    this.drawPaths(
      ctx,
      downWicks,
      downBodies,
      this.options.theme.candle.downColor
    );
  }

  private drawPaths(
    ctx: CanvasRenderingContext2D,
    wickPath: Path2D,
    bodyPath: Path2D,
    color: string
  ) {
    ctx.strokeStyle = color;
    ctx.stroke(wickPath);
    ctx.fillStyle = color;
    ctx.fill(bodyPath);
  }
}
