import type { ChartData, TimeRange } from "../chart/types";
import { PriceScale } from "./price-scale";
import { BarAlignment, TimeScale, TimeScaleRange } from "./time-scale";

export interface ScaleRangeModifier {
  readonly yMin?: number;
  readonly yMax?: number;
  readonly actor: unknown;
  readonly enabled: boolean;
}

export type DataScaleSource = "simple" | "ohlc";

export interface DataScaleTimeOptions {
  readonly barAlignment?: BarAlignment;
  readonly indexRange?: TimeScaleRange;
  readonly timeValues?: readonly number[];
}

export class DataScaleModel {
  private xMin!: number;
  private xMax!: number;
  private rawYMin!: number;
  private rawYMax!: number;
  private volMax!: number;
  private readonly topOffset = 0.15;
  private readonly bottomOffset = 0.2;
  private modifiers = new Map<unknown, ScaleRangeModifier>();

  private readonly timeScale: TimeScale;
  private readonly priceScale: PriceScale;
  private readonly volumeScale: PriceScale;

  constructor(
    private readonly source: DataScaleSource,
    dataset: readonly ChartData[],
    timeRange: TimeRange,
    timeOptions: DataScaleTimeOptions = {}
  ) {
    const barAlignment = timeOptions.barAlignment ?? "center";
    const indexRange =
      timeOptions.indexRange ?? this.getDefaultIndexRange(dataset);
    const timeValues =
      timeOptions.timeValues ?? dataset.map((data) => data.time);
    this.timeScale = new TimeScale(indexRange, {
      barAlignment,
      times: timeValues
    });
    this.priceScale = new PriceScale({ min: 0, max: 1 });
    this.volumeScale = new PriceScale({ min: 0, max: 1 });
    this.recalculate(dataset, timeRange);
  }

  recalculate(
    dataset: readonly ChartData[],
    timeRange: TimeRange,
    timeOptions: DataScaleTimeOptions = {}
  ): void {
    this.xMin = timeRange.start;
    this.xMax = timeRange.end;
    this.configureTimeScale(timeOptions);
    this.rawYMin = Infinity;
    this.rawYMax = -Infinity;
    this.volMax = -Infinity;

    for (const data of dataset) {
      if (this.source === "simple") {
        if (data.close != null) {
          this.rawYMin = Math.min(this.rawYMin, data.close);
          this.rawYMax = Math.max(this.rawYMax, data.close);
        }
      } else {
        if (data.low != null) {
          this.rawYMin = Math.min(this.rawYMin, data.low);
        }
        if (data.high != null) {
          this.rawYMax = Math.max(this.rawYMax, data.high);
        }
      }
      if (data.volume != null) {
        this.volMax = Math.max(this.volMax, data.volume);
      }
    }

    for (const modifier of this.modifiers.values()) {
      if (!modifier.enabled) continue;
      if (modifier.yMin != null) {
        this.rawYMin = Math.min(this.rawYMin, modifier.yMin);
      }
      if (modifier.yMax != null) {
        this.rawYMax = Math.max(this.rawYMax, modifier.yMax);
      }
    }

    if (!Number.isFinite(this.rawYMin) || !Number.isFinite(this.rawYMax)) {
      this.rawYMin = 0;
      this.rawYMax = 1;
    }
    if (!Number.isFinite(this.volMax)) {
      this.volMax = 0;
    }

    this.syncScales();
  }

  configureTimeScale(timeOptions: DataScaleTimeOptions) {
    if (timeOptions.indexRange) {
      this.timeScale.setRange(timeOptions.indexRange);
    }
    if (timeOptions.timeValues) {
      this.timeScale.setTimes(timeOptions.timeValues);
    }
    if (timeOptions.barAlignment) {
      this.timeScale.setBarAlignment(timeOptions.barAlignment);
    }
  }

  addModifier(modifier: ScaleRangeModifier) {
    this.modifiers.set(modifier.actor, modifier);
  }

  removeModifier(actor: unknown) {
    this.modifiers.delete(actor);
  }

  clearModifiers() {
    this.modifiers.clear();
  }

  addDataPoint(data: ChartData) {
    return this.source === "simple"
      ? this.addSimpleDataPoint(data)
      : this.addOhlcDataPoint(data);
  }

  mapToPixel(
    time: number,
    value: number,
    canvas: { width: number; height: number }
  ) {
    const options = { canvas };
    return {
      x: this.timeScale.project(time, options),
      y: this.priceScale.project(value, options)
    };
  }

  pixelToPoint(
    x: number,
    y: number,
    canvas: { width: number; height: number }
  ) {
    const options = { canvas };
    return {
      time: this.timeScale.unproject(x, options),
      price: this.priceScale.unproject(y, options)
    };
  }

  mapVolToPixel(
    time: number,
    volume: number,
    canvas: { width: number; height: number }
  ) {
    const options = { canvas };
    return {
      x: this.timeScale.project(time, options),
      y: this.volumeScale.projectVolume(volume, options)
    };
  }

  getTimeScale() {
    return this.timeScale;
  }

  getPriceScale() {
    return this.priceScale;
  }

  getVolumeScale() {
    return this.volumeScale;
  }

  getYMin() {
    return this.priceScale.getRange().min;
  }

  getYMax() {
    return this.priceScale.getRange().max;
  }

  getXMin() {
    return this.xMin;
  }

  getXMax() {
    return this.xMax;
  }

  getVolMax() {
    return this.volMax;
  }

  private getPaddedPriceRange() {
    let min = this.rawYMin;
    let max = this.rawYMax;
    if (min === max) {
      const padding = Math.max(Math.abs(min) * 0.01, 1);
      min -= padding;
      max += padding;
    }

    const span = max - min;
    return {
      min: min - span * this.bottomOffset,
      max: max + span * this.topOffset
    };
  }

  private syncScales() {
    this.priceScale.setRange(this.getPaddedPriceRange());
    this.volumeScale.setRange({ min: 0, max: this.volMax });
  }

  private getDefaultIndexRange(dataset: readonly ChartData[]): TimeScaleRange {
    return {
      from: 0,
      to: Math.max(dataset.length, 1),
      rightOffset: 0
    };
  }

  private addSimpleDataPoint(data: ChartData) {
    const time = data.time;

    let changed = time > this.xMax || time < this.xMin;

    this.xMin = Math.min(this.xMin, time);
    this.xMax = Math.max(this.xMax, time);

    if (data.close != null) {
      changed =
        changed ||
        data.close < this.rawYMin ||
        data.close > this.rawYMax;
      this.rawYMin = Math.min(this.rawYMin, data.close);
      this.rawYMax = Math.max(this.rawYMax, data.close);
    }

    if (data.volume != null) {
      changed = changed || data.volume > this.volMax;
      this.volMax = Math.max(this.volMax, data.volume);
    }

    this.syncScales();

    return changed;
  }

  private addOhlcDataPoint(data: ChartData) {
    const time = data.time;

    let changed = time > this.xMax || time < this.xMin;

    this.xMin = Math.min(this.xMin, time);
    this.xMax = Math.max(this.xMax, time);

    const low = data.low;
    const high = data.high;

    if (low != null) {
      changed = changed || low < this.rawYMin;
      this.rawYMin = Math.min(this.rawYMin, low);
    }
    if (high != null) {
      changed = changed || high > this.rawYMax;
      this.rawYMax = Math.max(this.rawYMax, high);
    }
    if (data.volume != null) {
      changed = changed || data.volume > this.volMax;
    }

    if (data.volume != null) {
      this.volMax = Math.max(this.volMax, data.volume);
    }
    this.syncScales();

    return changed;
  }
}
