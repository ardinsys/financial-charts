import { DataStore } from "../data/data-store";
import type { TimeScaleRange } from "../scales/time-scale";
import type { ChartData } from "./types";

/** Owns retained source bars and the step-sized data consumed by the chart. */
export class ChartModel {
  private originalData = new DataStore();
  private mappedData = new DataStore();

  get length(): number {
    return this.mappedData.length;
  }

  hasData(): boolean {
    return this.mappedData.length > 0;
  }

  getData(): readonly ChartData[] {
    return this.mappedData.snapshot();
  }

  getTimes(): readonly number[] {
    return this.mappedData.times();
  }

  getDataAt(index: number): ChartData | undefined {
    return this.mappedData.get(index);
  }

  replaceData(data: readonly ChartData[], stepSize: number): void {
    const originalData = new DataStore(data);
    const mappedData = new DataStore(
      DataStore.merge(originalData.snapshot(), stepSize)
    );
    this.originalData = originalData;
    this.mappedData = mappedData;
  }

  remapData(stepSize: number): void {
    this.mappedData = new DataStore(
      DataStore.merge(this.originalData.snapshot(), stepSize)
    );
  }

  appendData(data: ChartData, stepSize: number): ChartData {
    const latestTime = this.originalData.get(this.originalData.length - 1)?.time;
    if (latestTime !== undefined && data.time < latestTime) {
      throw new RangeError(
        "updateData() requires a timestamp at or after the latest point. Use setData() to apply older corrections."
      );
    }

    const originalIndex = this.originalData.append(data);
    const storedOriginal = this.originalData.get(originalIndex)!;
    const bucketTime = DataStore.bucketTime(storedOriginal.time, stepSize);
    this.mappedData.merge(storedOriginal, stepSize);
    return this.mappedData.get(this.mappedData.indexOfTime(bucketTime))!;
  }

  getNearestData(time: number): ChartData | undefined {
    const index = this.mappedData.nearestIndex(time);
    return index === -1 ? undefined : this.mappedData.get(index);
  }

  getIndexRangeForTimeRange(from: number, to: number): TimeScaleRange {
    return this.mappedData.indexRangeForTimeRange(from, to);
  }

  logicalIndexForTime(time: number, stepSize: number): number {
    return this.mappedData.logicalIndexForTime(time, stepSize);
  }

  timeAtLogicalIndex(index: number, stepSize: number): number {
    return this.mappedData.timeAtLogicalIndex(index, stepSize);
  }

  visibleData(from: number, to: number): ChartData[] {
    return this.mappedData.visibleIndexSlice(from, to);
  }
}
