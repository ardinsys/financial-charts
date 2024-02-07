import { ChartData } from "../chart/types";
import { OHLCController } from "./controller";

type Point = {
  x: number;
  y: number;
};

export class HLCAreaController extends OHLCController {
  static ID = "hlc-area";

  getXLabelOffset(): number {
    return 0;
  }

  getTimeFromRawDataPoint(rawPoint: ChartData): number {
    return (
      Math.round(rawPoint.time / this.options.stepSize) * this.options.stepSize
    );
  }

  draw(): void {
    const ctx = this.chart.getContext("main");

    const visibleDataPoints = this.chart.recalculateVisibleExtent();

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = this.options.theme.backgroundColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.chart.drawYAxis();
    this.chart.drawXAxis();

    const timeRange = this.chart.getTimeRange();
    const visibleExtent = this.chart.getVisibleExtent();
    const zoomLevel = this.chart.getZoomLevel();
    const panOffset = this.chart.getPanOffset();

    // Paths for the lines
    const highPath = new Path2D();
    const lowPath = new Path2D();
    const closePath = new Path2D();

    // Paths for the filled areas
    const highCloseArea = new Path2D();
    const closeLowArea = new Path2D();

    // Move to the first data point for each path
    let firstHigh!: Point,
      firstClose!: Point,
      firstLow!: Point,
      lastHigh!: Point,
      lastClose!: Point,
      lastLow!: Point;

    let foundFirst = false;
    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];
      if (point.time < timeRange.start) continue;
      if (point.time > timeRange.end) break;

      const high = visibleExtent.mapToPixel(
        point.time,
        point.high!,
        ctx.canvas,
        zoomLevel,
        panOffset
      );
      const low = visibleExtent.mapToPixel(
        point.time,
        point.low!,
        ctx.canvas,
        zoomLevel,
        panOffset
      );

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

      lastHigh = high;
      lastLow = low;
    }

    foundFirst = false;

    for (let i = visibleDataPoints.length - 1; i >= 0; i--) {
      const point = visibleDataPoints[i];
      if (point.time < timeRange.start) break;
      if (point.time > timeRange.end) continue;

      const close = visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        zoomLevel,
        panOffset
      );

      if (!foundFirst) {
        firstClose = close;
        foundFirst = true;

        closePath.moveTo(close.x, close.y);
      } else {
        closePath.lineTo(close.x, close.y);
      }

      lastClose = close;
    }

    // Draw the lines
    ctx.lineWidth = this.options.theme.hlcArea.width;
    ctx.strokeStyle = this.options.theme.hlcArea.high.color;
    ctx.stroke(highPath);

    ctx.strokeStyle = this.options.theme.hlcArea.low.color;
    ctx.stroke(lowPath);

    ctx.strokeStyle = this.options.theme.hlcArea.closeColor;
    ctx.stroke(closePath);

    // Close and fill the area between high and close
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
