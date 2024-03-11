import { ChartData, TimeRange } from "../chart/types";
import { DataExtent } from "../extents/data-extent";
import { SimpleDataExtent } from "../extents/simple-data-extent";
import { OHLCController } from "./controller";

export class SteplineController extends OHLCController {
  static ID = "stepline";

  private crosshairValues = [false, false, false, true];

  getEffectiveCrosshairValues(): boolean[] {
    return this.crosshairValues;
  }

  createDataExtent(data: ChartData[], timeRange: TimeRange): DataExtent {
    return new SimpleDataExtent(data, timeRange);
  }

  draw(): void {
    const ctx = this.chart.getContext("main");

    const visibleDataPoints = this.chart.recalculateVisibleExtent();

    ctx.beginPath();
    ctx.strokeStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;

    const timeRange = this.chart.getTimeRange();
    const visibleExtent = this.chart.getVisibleExtent();
    const zoomLevel = this.chart.getZoomLevel();
    const panOffset = this.chart.getPanOffset();

    // Start from the first data point
    let lastX = null;
    let lastY = null;

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];
      if (point.time < timeRange.start) continue;
      if (point.time > timeRange.end) break;

      if (point.close == undefined) continue;

      const { x, y } = visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        zoomLevel,
        panOffset
      );

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
