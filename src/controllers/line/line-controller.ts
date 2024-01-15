import { BaseChartOptions, ChartController, DeepConcrete } from "../controller";
import { DataExtent } from "../data-extent";
import { ChartData, TimeRange } from "../types";
import { LineDataExtent } from "./line-data-extent";

export interface LineChartOptions extends BaseChartOptions {}

export class LineController extends ChartController<LineChartOptions> {
  protected createDataExtent(
    data: ChartData[],
    timeRange: TimeRange
  ): DataExtent {
    return new LineDataExtent(data, timeRange);
  }

  constructor(
    container: HTMLElement,
    timeRange: TimeRange,
    options: LineChartOptions
  ) {
    super(container, timeRange, options as DeepConcrete<LineChartOptions>);
  }

  protected drawChart(): void {
    const ctx = this.getContext("main");

    const visibleTimeRange = this.getVisibleTimeRange();
    let firstPointIndex = 0;
    let lastPointIndex = this.data.length - 1;

    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].time >= visibleTimeRange.start - this.options.stepSize) {
        firstPointIndex = i;
        break;
      }
    }

    for (let i = this.data.length - 1; i >= 0; i--) {
      if (this.data[i].time <= visibleTimeRange.end) {
        lastPointIndex = i;
        break;
      }
    }

    const visibleDataPoints = this.data.slice(
      firstPointIndex,
      lastPointIndex + 1
    );

    // Do not recalc xMin and xMax to preserve x positions
    // but we need to adjust yMin and yMax to the visible data points
    this.visibleExtent.recalculate(visibleDataPoints, this.timeRange);

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = this.options.theme.backgroundColor;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawYAxis();
    this.drawXAxis();

    ctx.fillStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;
    ctx.beginPath();
    ctx.strokeStyle = this.options.theme.line.color;
    ctx.lineWidth = this.options.theme.line.width;
    let firstPoint = true;

    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
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
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  protected drawNewChartPoint(_: ChartData): void {
    if (!this.canDrawWithOptimization) {
      this.drawChart();
      return;
    }

    this.canDrawWithOptimization = false;

    const data = this.data[this.data.length - 1];
    const ctx = this.getContext("main");

    const { x, y } = this.visibleExtent.mapToPixel(
      data.time,
      data.close!,
      ctx.canvas,
      this.zoomLevel,
      this.panOffset
    );
    ctx.lineTo(x, y);
    ctx.stroke();
  }
}
