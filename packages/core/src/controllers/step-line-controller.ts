import type { ChartData, ChartDataValueKey, TimeRange } from "../chart/types";
import { DataScaleModel } from "../scales/data-scale-model";
import { OHLCController } from "./controller";

export class SteplineController extends OHLCController {
  static ID = "stepline";

  private static readonly steplineCrosshairValues = [
    "close",
    "volume",
  ] as const;

  getCrosshairValues(): readonly ChartDataValueKey[] {
    return SteplineController.steplineCrosshairValues;
  }

  createDataScale(
    data: readonly ChartData[],
    timeRange: TimeRange
  ): DataScaleModel {
    return new DataScaleModel("simple", data, timeRange, {
      barAlignment: this.getBarAlignment(),
    });
  }

  draw(): void {
    const {
      canvasContext: ctx,
      visibleData,
      visibleStartIndex,
      projectIndex,
      projectPrice,
    } = this.context.getDrawingContext();

    ctx.beginPath();
    ctx.strokeStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;

    let lastX = null;
    let lastY = null;

    for (let i = 0; i < visibleData.length; i++) {
      const point = visibleData[i];

      if (point.close == undefined) continue;

      const x = projectIndex(visibleStartIndex + i);
      const y = projectPrice(point.close!);

      if (lastX === null || lastY === null) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, lastY);
        ctx.lineTo(x, y);
      }

      lastX = x;
      lastY = y;
    }

    ctx.stroke();
  }
}
