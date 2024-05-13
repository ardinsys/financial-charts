import { FinancialChart } from "../chart/financial-chart";

export abstract class Extent {
  protected xMin!: number;
  protected xMax!: number;
  protected yMin!: number;
  protected yMax!: number;
  protected topOffset = 0.15;
  protected bottomOffset = 0.2;
  protected chart: FinancialChart;

  constructor(chart: FinancialChart) {
    this.chart = chart;
  }

  public mapToPixel(
    time: number,
    value: number,
    canvas: { width: number; height: number } = this.chart.getLogicalCanvas(
      "main"
    ),
    zoomLevel: number = this.chart.getZoomLevel(),
    panOffset: number = this.chart.getPanOffset()
  ) {
    const width = canvas.width / window.devicePixelRatio || 1;
    const height = canvas.height / window.devicePixelRatio || 1;
    // prettier-ignore
    const x = (((time - this.xMin) / (this.xMax - this.xMin)) * width - panOffset) * zoomLevel
    const y = (1 - (value - this.yMin) / (this.yMax - this.yMin)) * height;
    return { x, y };
  }

  public pixelToPoint(
    x: number,
    y: number,
    canvas: { width: number; height: number } = this.chart.getLogicalCanvas(
      "main"
    ),
    zoomLevel: number = this.chart.getZoomLevel(),
    panOffset: number = this.chart.getPanOffset()
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
