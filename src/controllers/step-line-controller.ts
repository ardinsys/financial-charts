import { ChartData, TimeRange } from "../chart/types";
import { DataScaleModel } from "../scales/data-scale-model";
import { OHLCController } from "./controller";

export class SteplineController extends OHLCController {
  static ID = "stepline";

  private crosshairValues = [false, false, false, true, true];

  getEffectiveCrosshairValues(): boolean[] {
    return this.crosshairValues;
  }

  createDataScale(data: ChartData[], timeRange: TimeRange): DataScaleModel {
    return new DataScaleModel("simple", data, timeRange, {
      barAlignment: this.getBarAlignment()
    });
  }

  draw(): void {
    const ctx = this.chart.getContext("main");

    const visibleDataPoints = this.chart.getLastVisibleDataPoints();

    ctx.beginPath();
    ctx.strokeStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;

    const timeScale = this.chart.getTimeScale();
    const priceScale = this.chart.getPriceScale();
    const scaleOptions = {
      canvas: ctx.canvas
    };

    // Start from the first data point
    let lastX = null;
    let lastY = null;

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];

      if (point.close == undefined) continue;

      const x = timeScale.project(point.time, scaleOptions);
      const y = priceScale.project(point.close!, scaleOptions);

      if (lastX === null || lastY === null) {
        ctx.moveTo(x, y);
      } else {
        // Move horizontally to the new X position
        ctx.lineTo(x, lastY);
        // Then move vertically to the new Y position
        ctx.lineTo(x, y);
      }

      // Update the last positions
      lastX = x;
      lastY = y;
    }

    ctx.stroke();
  }
}
