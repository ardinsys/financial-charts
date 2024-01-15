import { DataExtent } from "../data-extent";
import { ChartData, TimeRange } from "../types";

export class LineDataExtent extends DataExtent {
  public recalculate(dataset: ChartData[], timeRange: TimeRange): void {
    this.xMin = timeRange.start;
    this.xMax = timeRange.end;
    this.yMin = Infinity;
    this.yMax = -Infinity;

    for (const data of dataset) {
      this.yMin = Math.min(this.yMin, data.close!);
      this.yMax = Math.max(this.yMax, data.close!);
    }

    const yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    const yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    this.yMin = yMin;
    this.yMax = yMax;
  }
  constructor(dataset: ChartData[], timeRange: TimeRange) {
    super(dataset, timeRange);
  }

  public addDataPoint(data: ChartData) {
    const time = data.time;

    let changed = time > this.xMax || time < this.xMin;

    this.xMin = Math.min(this.xMin, time);
    this.xMax = Math.max(this.xMax, time);

    let yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    let yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    if (data.close !== null && data.close !== undefined) {
      changed = changed || data.close < yMin || data.close > yMax;
      this.yMin = Math.min(yMin, data.close!);
      this.yMax = Math.max(yMax, data.close!);

      yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
      yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

      this.yMin = yMin;
      this.yMax = yMax;
    }

    return changed;
  }
}
