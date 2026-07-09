import type { ChartData } from "../chart/types";

export class DataStore {
  private data: ChartData[];

  constructor(data: ChartData[] = []) {
    this.data = [...data];
  }

  get length() {
    return this.data.length;
  }

  get(index: number): ChartData | undefined {
    return this.data[index];
  }

  toArray(): ChartData[] {
    return [...this.data];
  }

  times(): number[] {
    return this.data.map((point) => point.time);
  }

  indexOfTime(time: number): number {
    const index = this.lowerBound(time);
    if (index >= this.data.length) return -1;
    return this.data[index].time === time ? index : -1;
  }

  nearestIndex(time: number): number {
    if (this.data.length === 0) return -1;

    const nextIndex = this.lowerBound(time);
    if (nextIndex === 0) return 0;
    if (nextIndex >= this.data.length) return this.data.length - 1;

    const previousIndex = nextIndex - 1;
    const previousDistance = Math.abs(time - this.data[previousIndex].time);
    const nextDistance = Math.abs(this.data[nextIndex].time - time);

    return previousDistance <= nextDistance ? previousIndex : nextIndex;
  }

  append(point: ChartData): number {
    const index = this.upperBound(point.time);
    this.data.splice(index, 0, point);
    return index;
  }

  merge(point: ChartData, stepSize: number): boolean {
    const bucketedPoint = DataStore.bucketPoint(point, stepSize);
    const existingIndex = this.indexOfTime(bucketedPoint.time);

    if (existingIndex !== -1) {
      this.data[existingIndex] = DataStore.mergePoints(
        this.data[existingIndex],
        bucketedPoint
      );
      return false;
    }

    this.append(bucketedPoint);
    return true;
  }

  visibleSlice(from: number, to: number): ChartData[] {
    if (this.data.length === 0 || from > to) return [];

    const startIndex = this.lowerBound(from);
    const endIndex = this.upperBound(to);
    return this.data.slice(startIndex, endIndex);
  }

  visibleIndexSlice(from: number, to: number): ChartData[] {
    if (this.data.length === 0 || from > to) return [];

    const startIndex = Math.max(0, Math.floor(from));
    const endIndex = Math.min(this.data.length, Math.ceil(to));
    return this.data.slice(startIndex, endIndex);
  }

  indexRangeForTimeRange(from: number, to: number) {
    if (this.data.length === 0 || from > to) {
      return { from: 0, to: 1 };
    }

    const startIndex = this.lowerBound(from);
    const endIndex = this.upperBound(to);
    const clampedStart = Math.min(startIndex, this.data.length - 1);

    return {
      from: clampedStart,
      to: Math.max(endIndex, clampedStart + 1)
    };
  }

  logicalIndexForTime(time: number, stepSize: number) {
    const extrapolationStep = Math.max(stepSize, Number.EPSILON);
    if (this.data.length === 0) return 0;

    const first = this.data[0];
    const lastIndex = this.data.length - 1;
    const last = this.data[lastIndex];

    if (time <= first.time) {
      return (time - first.time) / extrapolationStep;
    }
    if (time >= last.time) {
      return lastIndex + (time - last.time) / extrapolationStep;
    }

    const nextIndex = this.lowerBound(time);
    if (this.data[nextIndex]?.time === time) return nextIndex;

    const previousIndex = Math.max(0, nextIndex - 1);
    const previous = this.data[previousIndex];
    const next = this.data[nextIndex];
    const span = Math.max(next.time - previous.time, Number.EPSILON);

    return previousIndex + (time - previous.time) / span;
  }

  timeAtLogicalIndex(index: number, stepSize: number) {
    const extrapolationStep = Math.max(stepSize, Number.EPSILON);
    if (this.data.length === 0) return index * extrapolationStep;

    const first = this.data[0];
    const lastIndex = this.data.length - 1;
    const last = this.data[lastIndex];

    if (index <= 0) {
      return first.time + index * extrapolationStep;
    }
    if (index >= lastIndex) {
      return last.time + (index - lastIndex) * extrapolationStep;
    }

    const previousIndex = Math.floor(index);
    const nextIndex = Math.ceil(index);
    if (previousIndex === nextIndex) return this.data[previousIndex].time;

    const previous = this.data[previousIndex];
    const next = this.data[nextIndex];

    return (
      previous.time + (next.time - previous.time) * (index - previousIndex)
    );
  }

  static merge(data: ChartData[], stepSize: number): ChartData[] {
    const store = new DataStore();
    for (const point of data) {
      store.merge(point, stepSize);
    }
    return store.toArray();
  }

  private lowerBound(time: number): number {
    let low = 0;
    let high = this.data.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.data[mid].time < time) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  private upperBound(time: number): number {
    let low = 0;
    let high = this.data.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.data[mid].time <= time) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  private static bucketPoint(point: ChartData, stepSize: number): ChartData {
    if (point.time % stepSize === 0) return point;
    return { ...point, time: point.time - (point.time % stepSize) };
  }

  private static mergePoints(current: ChartData, next: ChartData): ChartData {
    return {
      ...current,
      open: current.open!,
      high: Math.max(current.high!, next.high!),
      low: Math.min(current.low!, next.low!),
      close: next.close!,
      volume: current.volume! + next.volume!
    };
  }
}
