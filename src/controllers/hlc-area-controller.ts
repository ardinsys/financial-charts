import type { ChartData, ChartDataValueKey } from "../chart/types";
import type { BarAlignment } from "../scales/time-scale";
import { OHLCController } from "./controller";

type Point = {
  x: number;
  y: number;
};

export class HLCAreaController extends OHLCController {
  static ID = "hlc-area";

  private static readonly hlcAreaCrosshairValues = [
    "high",
    "low",
    "close"
  ] as const;

  getCrosshairValues(): readonly ChartDataValueKey[] {
    return HLCAreaController.hlcAreaCrosshairValues;
  }

  getBarAlignment(): BarAlignment {
    return "center";
  }

  getTimeFromRawDataPoint(rawPoint: ChartData): number {
    return this.bucketTime(rawPoint.time, "round");
  }

  draw(): void {
    const {
      canvasContext: ctx,
      visibleData,
      visibleStartIndex,
      projectIndex,
      projectPrice
    } = this.context.getDrawingContext();
    if (visibleData.length === 0) return;
    if (
      !visibleData.some(
        (point) =>
          point.high != null && point.low != null && point.close != null
      )
    ) {
      return;
    }

    const highPath = new Path2D();
    const lowPath = new Path2D();
    const closePath = new Path2D();

    const highCloseArea = new Path2D();
    const closeLowArea = new Path2D();

    let firstHigh!: Point,
      firstClose!: Point,
      firstLow!: Point;

    let foundFirst = false;
    for (let i = 0; i < visibleData.length; i++) {
      const point = visibleData[i];

      if (
        point.high == undefined ||
        point.low == undefined ||
        point.close == undefined
      )
        continue;

      const high = {
        x: projectIndex(visibleStartIndex + i),
        y: projectPrice(point.high!)
      };
      const low = {
        x: projectIndex(visibleStartIndex + i),
        y: projectPrice(point.low!)
      };

      if (!foundFirst) {
        firstHigh = high;
        firstLow = low;
        foundFirst = true;

        highPath.moveTo(high.x, high.y);
        lowPath.moveTo(low.x, low.y);
      } else {
        highPath.lineTo(high.x, high.y);
        lowPath.lineTo(low.x, low.y);
      }

    }

    foundFirst = false;

    for (let i = visibleData.length - 1; i >= 0; i--) {
      const point = visibleData[i];
      if (
        point.high == undefined ||
        point.low == undefined ||
        point.close == undefined
      )
        continue;

      const close = {
        x: projectIndex(visibleStartIndex + i),
        y: projectPrice(point.close!)
      };

      if (!foundFirst) {
        firstClose = close;
        foundFirst = true;

        closePath.moveTo(close.x, close.y);
      } else {
        closePath.lineTo(close.x, close.y);
      }

    }

    ctx.lineWidth = this.options.theme.hlcArea.width;
    ctx.strokeStyle = this.options.theme.hlcArea.high.color;
    ctx.stroke(highPath);

    ctx.strokeStyle = this.options.theme.hlcArea.low.color;
    ctx.stroke(lowPath);

    ctx.strokeStyle = this.options.theme.hlcArea.closeColor;
    ctx.stroke(closePath);

    highCloseArea.addPath(highPath);
    highCloseArea.lineTo(firstClose.x, firstClose.y);
    highCloseArea.addPath(closePath);
    highCloseArea.lineTo(firstHigh!.x, firstHigh!.y);
    ctx.fillStyle = this.options.theme.hlcArea.high.fill;
    ctx.fill(highCloseArea);

    closeLowArea.addPath(lowPath);
    closeLowArea.lineTo(firstClose.x, firstClose.y);
    closeLowArea.addPath(closePath);
    closeLowArea.lineTo(firstLow!.x, firstLow!.y);
    ctx.fillStyle = this.options.theme.hlcArea.low.fill;
    ctx.fill(closeLowArea);
  }
}
