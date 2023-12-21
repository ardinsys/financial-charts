import { DataExtent } from "../data-extent";
import { ChartData, TimeRange } from "../types";

export class LineDataExtent extends DataExtent {
  public getYAxisValues(
    ctx: CanvasRenderingContext2D,
    padding: number
  ): number[] {
    // TODO: implement
    return [];
  }

  public getXAxisValues(
    ctx: CanvasRenderingContext2D,
    padding: number
  ): number[] {
    // TODO: implement
    return [];
  }

  constructor(dataset: ChartData[], timeRange: TimeRange) {
    super(dataset, timeRange);
  }

  public recalculate(dataset: ChartData[], timeRange: TimeRange) {
    this.xMin = timeRange.start;
    this.xMax = timeRange.end;
    this.yMin = Infinity;
    this.yMax = -Infinity;

    for (const data of dataset) {
      this.yMin = Math.min(this.yMin, data.close!);
      this.yMax = Math.max(this.yMax, data.close!);
    }
  }

  public addDataPoint(data: ChartData) {
    const time =
      typeof data.time === "number" ? data.time : new Date(data.time).getTime();

    let changed = time > this.xMax || time < this.xMin;

    this.xMin = Math.min(this.xMin, time);
    this.xMax = Math.max(this.xMax, time);
    if (data.close !== null && data.close !== undefined) {
      changed = changed || data.close < this.yMin || data.close > this.yMax;
      this.yMin = Math.min(this.yMin, data.close!);
      this.yMax = Math.max(this.yMax, data.close!);
    }

    return changed;
  }

  mapToPixel(
    time: number,
    price: number,
    canvas: HTMLCanvasElement,
    zoomLevel: number,
    panOffset: number
  ): { x: number; y: number } {
    // prettier-ignore
    const x = (((time - this.xMin) / (this.xMax - this.xMin)) * canvas.width - panOffset) * zoomLevel;
    const y =
      (1 - (price - this.yMin) / (this.yMax - this.yMin)) * canvas.height;
    return { x, y };
  }

  pixelToPoint(
    x: number,
    y: number,
    canvas: HTMLCanvasElement,
    zoomLevel: number,
    panOffset: number
  ): { time: number; price: number } {
    // prettier-ignore
    const time = ((x / zoomLevel + panOffset) / canvas.width) * (this.xMax - this.xMin) + this.xMin;
    const price = (1 - y / canvas.height) * (this.yMax - this.yMin) + this.yMin;
    return { time, price };
  }
}
