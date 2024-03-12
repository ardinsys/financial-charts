import { ChartData, TimeRange } from "../chart/types";

export abstract class DataExtent {
  protected xMin!: number;
  protected xMax!: number;
  protected yMin!: number;
  protected yMax!: number;
  protected volMax!: number;
  protected timeRange: TimeRange;
  protected topOffset = 0.15;
  protected bottomOffset = 0.2;

  constructor(dataset: ChartData[], timeRange: TimeRange) {
    this.recalculate(dataset, timeRange);
    this.timeRange = timeRange;
  }

  public abstract recalculate(dataset: ChartData[], timeRange: TimeRange): void;

  public abstract addDataPoint(data: ChartData): boolean;

  public mapVolToPixel(
    time: number,
    volume: number,
    canvas: { width: number; height: number },
    zoomLevel: number,
    panOffset: number
  ) {
    const width = canvas.width / window.devicePixelRatio || 1;
    const height = canvas.height / window.devicePixelRatio || 1;

    // Define the maximum column height as 20% of the canvas height
    const maxColumnHeight = height * 0.2;

    // Calculate the X position
    const x =
      (((time - this.xMin) / (this.xMax - this.xMin)) * width - panOffset) *
      zoomLevel;

    // Correctly calculate the Y position and column height
    // Volume is mapped so that this.volMax corresponds to maxColumnHeight
    let columnHeight = (volume / this.volMax) * maxColumnHeight;
    // Ensure the Y position is at the bottom of the chart minus the column height
    // This places the volume columns at the bottom of the canvas
    const y = columnHeight;

    return { x, y };
  }

  public mapToPixel(
    time: number,
    price: number,
    canvas: { width: number; height: number },
    zoomLevel: number,
    panOffset: number
  ) {
    const width = canvas.width / window.devicePixelRatio || 1;
    const height = canvas.height / window.devicePixelRatio || 1;
    // prettier-ignore
    const x = (((time - this.xMin) / (this.xMax - this.xMin)) * width - panOffset) * zoomLevel
    const y = (1 - (price - this.yMin) / (this.yMax - this.yMin)) * height;
    return { x, y };
  }

  public pixelToPoint(
    x: number,
    y: number,
    canvas: { width: number; height: number },
    zoomLevel: number,
    panOffset: number
  ) {
    const width = canvas.width / window.devicePixelRatio || 1;
    const height = canvas.height / window.devicePixelRatio || 1;
    // prettier-ignore
    const time = ((x / zoomLevel + panOffset) / width) * (this.xMax - this.xMin) + this.xMin;
    const price = (1 - y / height) * (this.yMax - this.yMin) + this.yMin;
    return { time, price };
  }

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
