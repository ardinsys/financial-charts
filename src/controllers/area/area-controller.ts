import { BaseChartOptions, ChartController, DeepConcrete } from "../controller";
import { DataExtent } from "../data-extent";
import { ChartData, TimeRange } from "../types";
import { AreaDataExtent } from "./area-data-extent";

export interface AreaChartOptions extends BaseChartOptions {}

export class AreaController extends ChartController<AreaChartOptions> {
  protected createDataExtent(
    data: ChartData[],
    timeRange: TimeRange
  ): DataExtent {
    return new AreaDataExtent(data, timeRange);
  }

  constructor(
    container: HTMLElement,
    timeRange: TimeRange,
    options: AreaChartOptions
  ) {
    super(container, timeRange, options as DeepConcrete<AreaChartOptions>);
  }

  // Convert hex color to RGBA
  hexToRGBA = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  protected drawChart(): void {
    const ctx = this.getContext("main");

    const visibleDataPoints = this.recalculateVisibleExtent();

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = this.options.theme.backgroundColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawYAxis();
    this.drawXAxis();

    // Create gradient (example: vertical gradient from top to bottom)
    const gradient = ctx.createLinearGradient(
      0,
      0,
      0,
      this.getLogicalCanvas("main").height
    );
    gradient.addColorStop(
      0,
      this.hexToRGBA(this.options.theme.line.color, 0.4)
    ); // Line color (opaque)
    gradient.addColorStop(1, this.hexToRGBA(this.options.theme.line.color, 0)); // Line color (transparent)

    ctx.fillStyle = gradient; // Use the gradient for the fill

    ctx.lineWidth = this.options.theme.line.width;
    const linePath = new Path2D();
    ctx.strokeStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;
    let firstPoint = true;
    let firstX = 0,
      firstY = 0,
      lastX = 0,
      lastY = 0;

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];
      if (point.time < this.timeRange.start) continue;
      if (point.time > this.timeRange.end) break;
      const { x, y } = this.visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      );

      if (firstPoint) {
        linePath.moveTo(x, y);
        firstPoint = false;
        firstX = x; // Remember the first point to close the path later
        firstY = y;
      } else {
        linePath.lineTo(x, y);
      }
      lastX = x; // Remember the last point to close the path later
      lastY = y;
    }

    ctx.stroke(linePath);

    ctx.strokeStyle = "transparent";
    ctx.lineWidth = 0;
    linePath.lineTo(lastX, ctx.canvas.height); // Down to the bottom of the chart
    linePath.lineTo(firstX, ctx.canvas.height); // Line to the start along the bottom
    linePath.closePath();

    ctx.fill(linePath); // Fill the closed area with the gradient
  }
}
