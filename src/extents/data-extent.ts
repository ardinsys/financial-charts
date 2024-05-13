import { FinancialChart } from "../chart/financial-chart";
import { ChartData, TimeRange } from "../chart/types";
import { Extent } from "./extent";

export abstract class DataExtent extends Extent {
  protected volMax!: number;
  protected timeRange!: TimeRange;

  constructor(
    chart: FinancialChart,
    dataset: ChartData[],
    timeRange: TimeRange
  ) {
    super(chart);
    this.timeRange = timeRange;
    this.recalculate(dataset, timeRange);
  }

  public abstract recalculate(dataset: ChartData[], timeRange: TimeRange): void;

  public abstract addDataPoint(data: ChartData): boolean;

  public mapVolToPixel(
    time: number,
    volume: number,
    canvas: { width: number; height: number } = this.chart.getLogicalCanvas(
      "main"
    ),
    zoomLevel: number = this.chart.getZoomLevel(),
    panOffset: number = this.chart.getPanOffset()
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

  getVolMax() {
    return this.volMax;
  }
}
