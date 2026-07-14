import type { ChartData } from "../chart/types";

type MutableChartData = {
  -readonly [Field in keyof ChartData]: ChartData[Field];
};

export class DataStore {
  private data: ChartData[];
  private dataSnapshot?: readonly ChartData[];
  private timeValues?: readonly number[];

  constructor(data: readonly ChartData[] = []) {
    this.data = data
      .map((point) => DataStore.copyPoint(point))
      .sort((left, right) => left.time - right.time);
  }

  get length() {
    return this.data.length;
  }

  get(index: number): ChartData | undefined {
    return this.data[index];
  }

  snapshot(): readonly ChartData[] {
    if (!this.dataSnapshot) {
      this.dataSnapshot = Object.freeze([...this.data]);
    }
    return this.dataSnapshot;
  }

  times(): readonly number[] {
    if (!this.timeValues) {
      this.timeValues = Object.freeze(this.data.map((point) => point.time));
    }
    return this.timeValues;
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
    const storedPoint = DataStore.copyPoint(point);
    const index = this.upperBound(storedPoint.time);
    this.data.splice(index, 0, storedPoint);
    this.dataSnapshot = undefined;
    this.timeValues = undefined;
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
      this.dataSnapshot = undefined;
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

  static merge(
    data: readonly ChartData[],
    stepSize: number
  ): readonly ChartData[] {
    const store = new DataStore();
    const sortedData = [...data].sort((left, right) => left.time - right.time);
    for (const point of sortedData) {
      store.merge(point, stepSize);
    }
    return store.snapshot();
  }

  static bucketTime(time: number, stepSize: number): number {
    if (!Number.isFinite(time)) {
      throw new TypeError("ChartData.time must be a finite number.");
    }
    if (!Number.isFinite(stepSize) || stepSize <= 0) {
      throw new RangeError(
        "stepSize must be a finite number greater than zero."
      );
    }

    return Math.floor(time / stepSize) * stepSize;
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
    const storedPoint = DataStore.copyPoint(point);
    const time = DataStore.bucketTime(storedPoint.time, stepSize);
    if (time === storedPoint.time) return storedPoint;
    return Object.freeze({ ...storedPoint, time });
  }

  private static mergePoints(current: ChartData, next: ChartData): ChartData {
    const result: MutableChartData = { time: current.time };

    DataStore.assignMergedValue(
      result,
      "open",
      current.open ?? next.open,
      current.open,
      next.open
    );
    DataStore.assignMergedValue(
      result,
      "high",
      DataStore.maximum(current.high, next.high),
      current.high,
      next.high
    );
    DataStore.assignMergedValue(
      result,
      "low",
      DataStore.minimum(current.low, next.low),
      current.low,
      next.low
    );
    DataStore.assignMergedValue(
      result,
      "close",
      next.close ?? current.close,
      current.close,
      next.close
    );
    DataStore.assignMergedValue(
      result,
      "volume",
      DataStore.sum(current.volume, next.volume),
      current.volume,
      next.volume
    );

    return Object.freeze(result);
  }

  private static copyPoint(point: ChartData): ChartData {
    if (!Number.isFinite(point.time)) {
      throw new TypeError("ChartData.time must be a finite number.");
    }

    for (const field of ["open", "high", "low", "close", "volume"] as const) {
      const value = point[field];
      if (value != null && !Number.isFinite(value)) {
        throw new TypeError(
          `ChartData.${field} must be a finite number when present.`
        );
      }
    }

    return Object.isFrozen(point) ? point : Object.freeze({ ...point });
  }

  private static assignMergedValue(
    result: MutableChartData,
    field: "open" | "high" | "low" | "close" | "volume",
    value: number | null | undefined,
    current: number | null | undefined,
    next: number | null | undefined
  ): void {
    if (value != null) {
      result[field] = value;
    } else if (current === null || next === null) {
      result[field] = null;
    }
  }

  private static maximum(
    current: number | null | undefined,
    next: number | null | undefined
  ): number | undefined {
    if (current == null) return next ?? undefined;
    if (next == null) return current;
    return Math.max(current, next);
  }

  private static minimum(
    current: number | null | undefined,
    next: number | null | undefined
  ): number | undefined {
    if (current == null) return next ?? undefined;
    if (next == null) return current;
    return Math.min(current, next);
  }

  private static sum(
    current: number | null | undefined,
    next: number | null | undefined
  ): number | undefined {
    if (current == null) return next ?? undefined;
    if (next == null) return current;
    return current + next;
  }
}
