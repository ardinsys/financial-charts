import { DataExtent } from "./data-extent";
import { ChartData, TimeRange } from "../chart/types";
import { FinancialChart } from "../chart/financial-chart";

export class OHLCDataExtent extends DataExtent {
  constructor(
    chart: FinancialChart,
    dataset: ChartData[],
    timeRange: TimeRange
  ) {
    super(chart, dataset, timeRange);
  }

  public recalculate(dataset: ChartData[], timeRange: TimeRange): void {
    this.xMin = timeRange.start;
    this.xMax = timeRange.end;
    this.yMin = Infinity;
    this.yMax = -Infinity;
    this.volMax = -Infinity;

    for (const data of dataset) {
      this.yMin = Math.min(this.yMin, data.low!);
      this.yMax = Math.max(this.yMax, data.high!);
      this.volMax = Math.max(this.volMax, data.volume!);
    }
    const yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    const yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    this.yMin = yMin;
    this.yMax = yMax;
  }

  public addDataPoint(data: ChartData) {
    const time = data.time;

    let changed = time > this.xMax || time < this.xMin;

    this.xMin = Math.min(this.xMin, time);
    this.xMax = Math.max(this.xMax, time);

    let yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    let yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    const low = data.low!;
    const high = data.high!;

    if (data.low !== null && data.low !== undefined) {
      changed = changed || low < yMin;
    }
    if (data.high !== null && data.high !== undefined) {
      changed = changed || high > yMax;
    }
    if (data.volume !== null && data.volume !== undefined) {
      changed = changed || data.volume > this.volMax;
    }

    this.yMin = Math.min(yMin, low);
    this.yMax = Math.max(yMax, high);

    yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    this.yMin = yMin;
    this.yMax = yMax;

    this.volMax = Math.max(this.volMax, data.volume!);

    return changed;
  }
}
