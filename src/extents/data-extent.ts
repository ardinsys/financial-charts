import { FinancialChart } from "../chart/financial-chart";
import { ChartData, TimeRange } from "../chart/types";
import { pixelRatio } from "../utils/screen";
import { Extent } from "./extent";

export interface ExtentModifier {
  yMin?: number;
  yMax?: number;
  actor: any;
  enabled: boolean;
}

export abstract class DataExtent extends Extent {
  protected volMax!: number;
  protected timeRange!: TimeRange;
  protected modifiers = new Map<any, ExtentModifier>();

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

  public addModifier(modifier: ExtentModifier) {
    this.modifiers.set(modifier.actor, modifier);
  }

  public removeModifier(actor: any) {
    this.modifiers.delete(actor);
  }

  public abstract addDataPoint(data: ChartData): boolean;

  public mapVolToPixel(
    time: number,
    volume: number,
    canvas: { width: number; height: number } = this.chart.getContext("main")
      .canvas,
    zoomLevel: number = this.chart.getZoomLevel(),
    panOffset: number = this.chart.getPanOffset()
  ) {
    const ratio = pixelRatio();
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;

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
