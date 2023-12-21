import { ChartController } from "../controller";
import { DataExtent } from "../data-extent";
import { ChartData, TimeRange } from "../types";
import { LineDataExtent } from "./line-data-extent";

export interface LineChartOptions {
  stroke: {
    width: number;
    color: string;
  };
}

export class LineController extends ChartController<LineChartOptions> {
  protected getMaxZoomLevel(): number {
    return 5;
  }
  protected transformData(data: ChartData[]): ChartData[] {
    return data.map((d) => ({ ...d }));
  }

  protected transformNewData(data: ChartData): ChartData {
    return { ...data };
  }

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
    super(container, timeRange, options);
  }

  protected drawChart(): void {
    const ctx = this.getContext("main");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = this.options.stroke.color;
    ctx.lineWidth = this.options.stroke.width;
    ctx.beginPath();
    ctx.strokeStyle = this.options.stroke.color;
    ctx.lineWidth = this.options.stroke.width;
    let firstPoint = true;

    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
      if (point.time < this.timeRange.start) continue;
      if (point.time > this.timeRange.end) break;
      const { x, y } = this.dataExtent.mapToPixel(
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

  protected drawNewChartPoint(data: ChartData): void {
    const ctx = this.getContext("main");
    const { x, y } = this.dataExtent.mapToPixel(
      data.time,
      data.close!,
      ctx.canvas,
      this.zoomLevel,
      this.panOffset
    );
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  protected pointerMove(e: { x: number; y: number }) {
    // TODO: crosshair and stuff
  }
}
