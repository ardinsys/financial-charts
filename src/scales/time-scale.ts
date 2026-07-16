import {
  Scale,
  ScaleProjectOptions,
  ScaleTick,
  ScaleTickOptions,
  resolveDevicePixelRatio
} from "./scale";

export interface TimeScaleRange {
  readonly from: number;
  readonly to: number;
  readonly rightOffset?: number;
}

export type BarAlignment = "center" | "edge";

export interface TimeScaleOptions {
  readonly barAlignment?: BarAlignment;
  readonly times?: readonly number[];
}

export class TimeScale implements Scale {
  private range: TimeScaleRange;
  private times: readonly number[];
  private barAlignment: BarAlignment;

  constructor(
    range: TimeScaleRange,
    options: TimeScaleOptions = {}
  ) {
    this.range = copyRange(range);
    this.times = options.times ?? [];
    this.barAlignment = options.barAlignment ?? "center";
  }

  setRange(range: TimeScaleRange): void {
    if (
      this.range.from === range.from &&
      this.range.to === range.to &&
      this.range.rightOffset === range.rightOffset
    ) {
      return;
    }
    this.range = copyRange(range);
  }

  getRange(): TimeScaleRange {
    return this.range;
  }

  setTimes(times: readonly number[]) {
    this.times = times;
  }

  setBarAlignment(alignment: BarAlignment) {
    this.barAlignment = alignment;
  }

  project(value: number, options: ScaleProjectOptions): number {
    const index = this.indexForValue(value);

    return this.projectIndex(index, options);
  }

  unproject(pixel: number, options: ScaleProjectOptions): number {
    const alignment = options.barAlignment ?? this.barAlignment;
    const projectedIndex = this.unprojectIndex(pixel, options);
    const index =
      alignment === "edge"
        ? Math.floor(projectedIndex)
        : Math.round(projectedIndex);

    return this.valueForIndex(index);
  }

  projectIndex(index: number, options: ScaleProjectOptions): number {
    const ratio = resolveDevicePixelRatio(options);
    const width = options.canvas.width / ratio;
    const span = this.getSpan();
    const coordinate =
      index + this.alignmentOffset(options.barAlignment ?? this.barAlignment);

    return ((coordinate - this.range.from) / span) * width;
  }

  unprojectIndex(pixel: number, options: ScaleProjectOptions): number {
    const ratio = resolveDevicePixelRatio(options);
    const width = options.canvas.width / ratio;
    const span = this.getSpan();
    const coordinate = this.range.from + (pixel / width) * span;

    return (
      coordinate -
      this.alignmentOffset(options.barAlignment ?? this.barAlignment)
    );
  }

  getTicks(_options: ScaleTickOptions): ScaleTick[] {
    return [];
  }

  private getSpan() {
    return Math.max(this.range.to - this.range.from, Number.EPSILON);
  }

  private alignmentOffset(alignment: BarAlignment) {
    return alignment === "center" ? 0.5 : 0;
  }

  private indexForValue(value: number) {
    if (this.times.length === 0) return value;

    const index = this.lowerBound(value);
    if (index >= this.times.length) return this.times.length - 1;
    if (this.times[index] === value || index === 0) return index;

    const previousIndex = index - 1;
    const previousDistance = Math.abs(value - this.times[previousIndex]);
    const nextDistance = Math.abs(this.times[index] - value);

    return previousDistance <= nextDistance ? previousIndex : index;
  }

  private valueForIndex(index: number) {
    if (this.times.length === 0) return index;

    const clampedIndex = Math.max(0, Math.min(index, this.times.length - 1));

    return this.times[clampedIndex];
  }

  private lowerBound(value: number): number {
    let low = 0;
    let high = this.times.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.times[mid] < value) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }
}

function copyRange(range: TimeScaleRange): TimeScaleRange {
  return { ...range };
}
