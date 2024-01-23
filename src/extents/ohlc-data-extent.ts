import { DataExtent } from "./data-extent";
import { ChartData, TimeRange } from "../chart/types";

export class OHLCDataExtent extends DataExtent {
  public recalculate(dataset: ChartData[], timeRange: TimeRange): void {
    this.xMin = timeRange.start;
    this.xMax = timeRange.end;
    this.yMin = Infinity;
    this.yMax = -Infinity;

    for (const data of dataset) {
      this.yMin = Math.min(this.yMin, data.low!);
      this.yMax = Math.max(this.yMax, data.high!);
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

    const low = data.low!;
    const high = data.high!;

    if (data.low !== null && data.low !== undefined) {
      changed = changed || low < yMin;
    }
    if (data.high !== null && data.high !== undefined) {
      changed = changed || high > yMax;
    }

    this.yMin = Math.min(yMin, low);
    this.yMax = Math.max(yMax, high);

    yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    this.yMin = yMin;
    this.yMax = yMax;

    return changed;
  }
}
