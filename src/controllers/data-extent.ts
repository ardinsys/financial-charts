import { ChartData, TimeRange } from "./types";

export abstract class DataExtent {
  protected xMin!: number;
  protected xMax!: number;
  protected yMin!: number;
  protected yMax!: number;
  protected timeRange: TimeRange;

  constructor(dataset: ChartData[], timeRange: TimeRange) {
    this.recalculate(dataset, timeRange);
    this.timeRange = timeRange;
  }

  public abstract recalculate(dataset: ChartData[], timeRange: TimeRange): void;

  public abstract addDataPoint(data: ChartData): boolean;

  public abstract mapToPixel(
    time: number,
    price: number,
    canvas: HTMLCanvasElement,
    zoomLevel: number,
    panOffset: number
  ): { x: number; y: number };

  public abstract pixelToPoint(
    x: number,
    y: number,
    canvas: HTMLCanvasElement,
    zoomLevel: number,
    panOffset: number
  ): { time: number; price: number };

  public abstract getYAxisValues(
    ctx: CanvasRenderingContext2D,
    padding: number
  ): number[];

  public abstract getXAxisValues(
    ctx: CanvasRenderingContext2D,
    padding: number
  ): number[];

  getYMin() {
    return this.yMin;
  }

  getYMax() {
    return this.yMax;
  }

  getXMin() {
    return this.xMin;
  }

  getXMax() {
    return this.xMax;
  }
}
