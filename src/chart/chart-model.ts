import { DataStore } from "../data/data-store";
import {
  DataScaleModel,
  type DataScaleTimeOptions,
  type ScaleRangeModifier
} from "../scales/data-scale-model";
import type { BarAlignment, TimeScaleRange } from "../scales/time-scale";
import type { ChartData, TimeRange } from "./types";

const logicalRangeEpsilon = 1e-9;

interface RefreshIndexBoundsOptions {
  readonly minimumVisibleSlots: number;
  readonly reset?: boolean;
  readonly preserveRightEdge?: boolean;
  readonly span?: number;
}

type DataScaleFactory = (
  data: readonly ChartData[],
  timeRange: TimeRange
) => DataScaleModel;

/** Owns chart data, logical/time view state, and scale models. */
export class ChartModel {
  private originalData = new DataStore();
  private mappedData = new DataStore();
  private autoTimeRange = false;
  private timeRange = freezeTimeRange({ start: 0, end: 0 });
  private indexBounds = freezeIndexRange({
    from: 0,
    to: 1,
    rightOffset: 0
  });
  private visibleIndexRange = this.indexBounds;
  private scaleFactory?: DataScaleFactory;
  private barAlignment: BarAlignment = "center";
  private dataScale?: DataScaleModel;
  private visibleScale?: DataScaleModel;
  private visibleDataPoints: readonly ChartData[] = Object.freeze([]);

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

  configureScales(
    factory: DataScaleFactory,
    barAlignment: BarAlignment
  ): void {
    this.scaleFactory = factory;
    this.barAlignment = barAlignment;
    this.dataScale = factory(this.getData(), this.timeRange);
    this.visibleScale = factory([], { start: 0, end: 0 });
    this.syncTimeScales();
  }

  rebuildDataScale(): void {
    this.dataScale = this.requireScaleFactory()(
      this.getData(),
      this.timeRange
    );
    this.syncTimeScales();
  }

  recalculateDataScale(): void {
    this.getDataScale().recalculate(
      this.getData(),
      this.timeRange,
      this.getTimeScaleOptions()
    );
  }

  addDataScalePoint(data: ChartData): void {
    this.getDataScale().addDataPoint(data);
  }

  clearScaleData(): void {
    this.dataScale = this.requireScaleFactory()([], this.timeRange);
    const visibleScale = this.getVisibleScale();
    visibleScale.clearModifiers();
    visibleScale.recalculate(
      [],
      this.timeRange,
      this.getTimeScaleOptions()
    );
    this.visibleDataPoints = Object.freeze([]);
    this.syncTimeScales();
  }

  recalculateVisibleScale(
    modifiers: readonly ScaleRangeModifier[]
  ): readonly ChartData[] {
    const visibleDataPoints = this.sliceVisibleData(1);
    const visibleScale = this.getVisibleScale();
    for (const modifier of modifiers) {
      visibleScale.addModifier(modifier);
    }
    visibleScale.recalculate(
      visibleDataPoints,
      this.timeRange,
      this.getTimeScaleOptions()
    );
    this.visibleDataPoints = Object.freeze(visibleDataPoints);
    return this.visibleDataPoints;
  }

  getDataScale(): DataScaleModel {
    if (!this.dataScale) {
      throw new Error("Chart data scale has not been configured.");
    }
    return this.dataScale;
  }

  getVisibleScale(): DataScaleModel {
    if (!this.visibleScale) {
      throw new Error("Chart visible scale has not been configured.");
    }
    return this.visibleScale;
  }

  getTimeScale() {
    return this.getVisibleScale().getTimeScale();
  }

  getBarAlignment(): BarAlignment {
    return this.barAlignment;
  }

  getVisibleDataPoints(): readonly ChartData[] {
    return this.visibleDataPoints;
  }

  removeVisibleScaleModifier(actor: unknown): void {
    this.getVisibleScale().removeModifier(actor);
  }

  getTimeRange(): TimeRange {
    return this.timeRange;
  }

  isAutoTimeRange(): boolean {
    return this.autoTimeRange;
  }

  configureTimeRange(
    range: TimeRange | "auto",
    stepSize: number,
    minimumVisibleSlots: number
  ): void {
    this.autoTimeRange = range === "auto";
    if (range === "auto") {
      this.updateAutoTimeRange(stepSize, minimumVisibleSlots);
    } else {
      this.updateTimeRange(range);
    }
  }

  updateAutoTimeRange(stepSize: number, minimumVisibleSlots: number): void {
    if (!this.autoTimeRange || !this.hasData()) {
      if (this.autoTimeRange) {
        this.updateTimeRange({ start: 0, end: 0 });
      }
      return;
    }

    const firstPoint = this.mappedData.get(0)!;
    const lastPoint = this.mappedData.get(this.mappedData.length - 1)!;
    this.updateTimeRange({
      start: firstPoint.time,
      end: Math.max(
        lastPoint.time + stepSize,
        firstPoint.time + minimumVisibleSlots * stepSize
      )
    });
  }

  getVisibleIndexRange(): TimeScaleRange {
    return this.visibleIndexRange;
  }

  getVisibleIndexSpan(): number {
    return Math.max(
      this.visibleIndexRange.to - this.visibleIndexRange.from,
      1
    );
  }

  getIndexBoundsSpan(): number {
    return Math.max(this.indexBounds.to - this.indexBounds.from, 1);
  }

  isPinnedToRightEdge(): boolean {
    return (
      Math.abs(this.visibleIndexRange.to - this.indexBounds.to) < 1e-6
    );
  }

  resetViewInteractionState(): void {
    this.indexBounds = freezeIndexRange({ from: 0, to: 1 });
    this.visibleIndexRange = this.indexBounds;
  }

  resetEmptyView(): void {
    if (this.autoTimeRange) {
      this.updateTimeRange({ start: 0, end: 0 });
    }
    this.indexBounds = freezeIndexRange({
      from: 0,
      to: 1,
      rightOffset: 0
    });
    this.visibleIndexRange = this.indexBounds;
  }

  refreshIndexBounds(options: RefreshIndexBoundsOptions): boolean {
    const span = options.span ?? this.getVisibleIndexSpan();
    const nextBounds = this.calculateIndexBounds(options.minimumVisibleSlots);
    if (!indexRangesEqual(this.indexBounds, nextBounds)) {
      this.indexBounds = freezeIndexRange(nextBounds);
    }

    let range = this.visibleIndexRange;
    if (options.reset) {
      range = this.indexBounds;
    } else if (options.preserveRightEdge) {
      const clampedSpan = Math.min(span, this.getIndexBoundsSpan());
      range = {
        from: this.indexBounds.to - clampedSpan,
        to: this.indexBounds.to
      };
    }

    return this.setVisibleIndexRange(range);
  }

  setVisibleIndexRange(range: TimeScaleRange): boolean {
    const previous = this.visibleIndexRange;
    const next = this.clampVisibleIndexRange(range);
    const changed =
      Math.abs(previous.from - next.from) > logicalRangeEpsilon ||
      Math.abs(previous.to - next.to) > logicalRangeEpsilon;

    if (changed || previous.rightOffset !== next.rightOffset) {
      this.visibleIndexRange = changed
        ? freezeIndexRange(next)
        : freezeIndexRange({
            ...previous,
            rightOffset: next.rightOffset
          });
    }
    this.syncTimeScales();
    return changed;
  }

  logicalRangeForTimeRange(range: TimeRange): TimeScaleRange {
    assertFiniteTimeRange(range);
    const end = Math.max(range.start, range.end - 1);
    return this.mappedData.indexRangeForTimeRange(range.start, end);
  }

  logicalRangeForTimeWindow(
    range: TimeRange,
    stepSize: number,
    alignment: BarAlignment
  ): TimeScaleRange {
    assertFiniteTimeRange(range);
    const alignmentOffset = alignment === "center" ? 0.5 : 0;
    const from =
      this.mappedData.logicalIndexForTime(range.start, stepSize) +
      alignmentOffset;
    const to =
      this.mappedData.logicalIndexForTime(range.end, stepSize) +
      alignmentOffset;

    return { from, to: Math.max(from + 1, to) };
  }

  getVisibleTimeRange(stepSize: number): TimeRange {
    if (!this.hasData()) return this.timeRange;

    const startIndex = Math.max(
      0,
      Math.min(
        Math.floor(this.visibleIndexRange.from),
        this.mappedData.length - 1
      )
    );
    const endIndex = Math.max(
      startIndex,
      Math.min(
        Math.ceil(this.visibleIndexRange.to) - 1,
        this.mappedData.length - 1
      )
    );
    const startPoint = this.mappedData.get(startIndex)!;
    const endPoint = this.mappedData.get(endIndex)!;

    return {
      start: startPoint.time,
      end: endPoint.time + stepSize
    };
  }

  getVisibleTimeWindow(
    stepSize: number,
    alignment: BarAlignment
  ): TimeRange {
    if (!this.hasData()) return this.timeRange;

    const alignmentOffset = alignment === "center" ? 0.5 : 0;
    return {
      start: this.mappedData.timeAtLogicalIndex(
        this.visibleIndexRange.from - alignmentOffset,
        stepSize
      ),
      end: this.mappedData.timeAtLogicalIndex(
        this.visibleIndexRange.to - alignmentOffset,
        stepSize
      )
    };
  }

  sliceVisibleData(margin = 0): ChartData[] {
    return this.mappedData.visibleIndexSlice(
      this.visibleIndexRange.from - margin,
      this.visibleIndexRange.to + margin
    );
  }

  private calculateIndexBounds(
    minimumVisibleSlots: number
  ): TimeScaleRange {
    if (!this.hasData()) {
      return { from: 0, to: 1, rightOffset: 0 };
    }

    if (this.autoTimeRange) {
      const slotCount = Math.max(this.mappedData.length, minimumVisibleSlots);
      return {
        from: 0,
        to: slotCount,
        rightOffset: Math.max(0, slotCount - this.mappedData.length)
      };
    }

    const range = this.mappedData.indexRangeForTimeRange(
      this.timeRange.start,
      this.timeRange.end
    );
    return {
      from: range.from,
      to: range.to,
      rightOffset: Math.max(0, range.to - this.mappedData.length)
    };
  }

  private clampVisibleIndexRange(range: TimeScaleRange): TimeScaleRange {
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to)) {
      throw new RangeError("Visible index range values must be finite.");
    }

    const boundsSpan = this.getIndexBoundsSpan();
    const requestedSpan = Math.max(range.to - range.from, 1);
    const span = Math.min(requestedSpan, boundsSpan);
    let from = range.from;
    let to = from + span;

    if (to > this.indexBounds.to) {
      to = this.indexBounds.to;
      from = to - span;
    }

    if (from < this.indexBounds.from) {
      from = this.indexBounds.from;
      to = from + span;
    }

    return {
      from,
      to,
      rightOffset: Math.max(0, to - this.mappedData.length)
    };
  }

  private updateTimeRange(range: TimeRange): void {
    if (
      this.timeRange.start === range.start &&
      this.timeRange.end === range.end
    ) {
      return;
    }
    this.timeRange = freezeTimeRange(range);
  }

  private getTimeScaleOptions(): DataScaleTimeOptions {
    return {
      barAlignment: this.barAlignment,
      indexRange: this.visibleIndexRange,
      timeValues: this.getTimes()
    };
  }

  private syncTimeScales(): void {
    if (!this.visibleScale) return;
    const options = this.getTimeScaleOptions();
    this.visibleScale.configureTimeScale(options);
    this.dataScale?.configureTimeScale(options);
  }

  private requireScaleFactory(): DataScaleFactory {
    if (!this.scaleFactory) {
      throw new Error("Chart scale factory has not been configured.");
    }
    return this.scaleFactory;
  }
}

function assertFiniteTimeRange(range: TimeRange): void {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    throw new RangeError("Visible time range values must be finite.");
  }
}

function freezeTimeRange(range: TimeRange): TimeRange {
  return Object.freeze({ ...range });
}

function freezeIndexRange(range: TimeScaleRange): TimeScaleRange {
  return Object.freeze({ ...range });
}

function indexRangesEqual(
  left: TimeScaleRange,
  right: TimeScaleRange
): boolean {
  return (
    left.from === right.from &&
    left.to === right.to &&
    left.rightOffset === right.rightOffset
  );
}
