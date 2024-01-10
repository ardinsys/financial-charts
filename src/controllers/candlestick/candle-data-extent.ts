import { DataExtent } from "../data-extent";
import { ChartData, TimeRange } from "../types";

export class CandlestickDataExtent extends DataExtent {
  constructor(dataset: ChartData[], timeRange: TimeRange) {
    super(dataset, timeRange);
  }

  public getXAxisValues(
    ctx: CanvasRenderingContext2D,
    padding: number
  ): number[] {
    const xAxisValues: number[] = [];
    const availableWidth = ctx.canvas.width - 80;
    const timeRange = this.xMax - this.xMin;
    const numberOfPoints = Math.floor(availableWidth / padding);

    for (let i = 0; i <= numberOfPoints; i++) {
      const x = availableWidth * (i / numberOfPoints);
      const time = this.xMin + timeRange * (x / availableWidth);
      xAxisValues.push(time);
    }

    return xAxisValues;
  }

  public getYAxisValues(
    ctx: CanvasRenderingContext2D,
    padding: number
  ): number[] {
    const yAxisValues: number[] = [];
    const availableHeight = ctx.canvas.height - 40;
    const priceRange = this.yMax - this.yMin;
    const numberOfLines = Math.floor(availableHeight / padding);

    for (let i = 1; i < numberOfLines; i++) {
      const y = availableHeight * (i / numberOfLines);
      const price = this.yMax - priceRange * (y / availableHeight);
      yAxisValues.push(price);
    }

    return yAxisValues;
  }

  public recalculate(dataset: ChartData[], timeRange: TimeRange) {
    this.xMin = timeRange.start;
    this.xMax = timeRange.end;
    this.yMin = Infinity;
    this.yMax = -Infinity;

    for (const data of dataset) {
      this.yMin = Math.min(this.yMin, data.low!);
      this.yMax = Math.max(this.yMax, data.high!);
    }
  }

  public addDataPoint(data: ChartData) {
    const time = data.time;

    let changed = time > this.xMax || time < this.xMin;

    this.xMin = Math.min(this.xMin, time);
    this.xMax = Math.max(this.xMax, time);
    if (data.low !== null && data.low !== undefined) {
      changed = changed || data.low < this.yMin;
      this.yMin = Math.min(this.yMin, data.low!);
    }
    if (data.high !== null && data.high !== undefined) {
      changed = changed || data.high > this.yMax;
      this.yMax = Math.max(this.yMax, data.high!);
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
    const width = canvas.width / window.devicePixelRatio || 1;
    const height = canvas.height / window.devicePixelRatio || 1;
    // prettier-ignore
    const x = (((time - this.xMin) / (this.xMax - this.xMin)) * width - panOffset) * zoomLevel
    const y = (1 - (price - this.yMin) / (this.yMax - this.yMin)) * height;
    return { x, y };
  }

  pixelToPoint(
    x: number,
    y: number,
    canvas: HTMLCanvasElement,
    zoomLevel: number,
    panOffset: number
  ): { time: number; price: number } {
    const width = canvas.width / window.devicePixelRatio || 1;
    const height = canvas.height / window.devicePixelRatio || 1;
    // prettier-ignore
    const time = ((x / zoomLevel + panOffset) / width) * (this.xMax - this.xMin) + this.xMin;
    const price = (1 - y / height) * (this.yMax - this.yMin) + this.yMin;
    return { time, price };
  }
}
