import type { ChartData, TimeRange } from "../chart/types";
import { PriceScale } from "./price-scale";
import { BarAlignment, TimeScale, TimeScaleRange } from "./time-scale";

export interface ScaleRangeModifier {
  yMin?: number;
  yMax?: number;
  actor: any;
  enabled: boolean;
}

export type DataScaleSource = "simple" | "ohlc";

export interface DataScaleTimeOptions {
  barAlignment?: BarAlignment;
  indexRange?: TimeScaleRange;
  timeValues?: readonly number[];
}

export class DataScaleModel {
  private xMin!: number;
  private xMax!: number;
  private yMin!: number;
  private yMax!: number;
  private volMax!: number;
  private readonly topOffset = 0.15;
  private readonly bottomOffset = 0.2;
  private modifiers = new Map<any, ScaleRangeModifier>();
  private barAlignment: BarAlignment;
  private indexRange: TimeScaleRange;
  private timeValues: readonly number[];

  private readonly timeScale: TimeScale;
  private readonly priceScale: PriceScale;
  private readonly volumeScale: PriceScale;

  constructor(
    private readonly source: DataScaleSource,
    dataset: readonly ChartData[],
    timeRange: TimeRange,
    timeOptions: DataScaleTimeOptions = {}
  ) {
    this.barAlignment = timeOptions.barAlignment ?? "center";
    this.indexRange =
      timeOptions.indexRange ?? this.getDefaultIndexRange(dataset);
    this.timeValues =
      timeOptions.timeValues ?? dataset.map((data) => data.time);
    this.timeScale = new TimeScale(this.indexRange, {
      barAlignment: this.barAlignment,
      times: this.timeValues
    });
    this.priceScale = new PriceScale({ min: 0, max: 1 });
    this.volumeScale = new PriceScale({ min: 0, max: 1 });
    this.recalculate(dataset, timeRange, timeOptions);
  }

  recalculate(
    dataset: readonly ChartData[],
    timeRange: TimeRange,
    timeOptions: DataScaleTimeOptions = {}
  ): void {
    this.xMin = timeRange.start;
    this.xMax = timeRange.end;
    this.configureTimeScale(timeOptions);
    this.yMin = Infinity;
    this.yMax = -Infinity;
    this.volMax = -Infinity;

    for (const data of dataset) {
      if (this.source === "simple") {
        if (data.close != null) {
          this.yMin = Math.min(this.yMin, data.close);
          this.yMax = Math.max(this.yMax, data.close);
        }
      } else {
        if (data.low != null) this.yMin = Math.min(this.yMin, data.low);
        if (data.high != null) this.yMax = Math.max(this.yMax, data.high);
      }
      if (data.volume != null) {
        this.volMax = Math.max(this.volMax, data.volume);
      }
    }

    for (const modifier of this.modifiers.values()) {
      if (!modifier.enabled) continue;
      if (modifier.yMin != null) {
        this.yMin = Math.min(this.yMin, modifier.yMin);
      }
      if (modifier.yMax != null) {
        this.yMax = Math.max(this.yMax, modifier.yMax);
      }
    }

    if (!Number.isFinite(this.yMin) || !Number.isFinite(this.yMax)) {
      this.yMin = 0;
      this.yMax = 1;
    }
    if (!Number.isFinite(this.volMax)) {
      this.volMax = 0;
    }

    this.applyOffsets();
    this.syncScales();
  }

  configureTimeScale(timeOptions: DataScaleTimeOptions) {
    this.barAlignment = timeOptions.barAlignment ?? this.barAlignment;
    this.indexRange = timeOptions.indexRange ?? this.indexRange;
    this.timeValues = timeOptions.timeValues ?? this.timeValues;

    this.timeScale.setBarAlignment(this.barAlignment);
    this.timeScale.setRange(this.indexRange);
    this.timeScale.setTimes(this.timeValues);
  }

  addModifier(modifier: ScaleRangeModifier) {
    this.modifiers.set(modifier.actor, modifier);
  }

  removeModifier(actor: any) {
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

  getVolMax() {
    return this.volMax;
  }

  private applyOffsets() {
    if (this.yMin === this.yMax) {
      const padding = Math.max(Math.abs(this.yMin) * 0.01, 1);
      this.yMin -= padding;
      this.yMax += padding;
    }

    const yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    const yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    this.yMin = yMin;
    this.yMax = yMax;
  }

  private syncScales() {
    this.timeScale.setRange(this.indexRange);
    this.timeScale.setTimes(this.timeValues);
    this.timeScale.setBarAlignment(this.barAlignment);
    this.priceScale.setRange({ min: this.yMin, max: this.yMax });
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

    let yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    let yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    const low = data.low;
    const high = data.high;

    if (low != null && data.low !== undefined) {
      changed = changed || low < yMin;
    }
    if (high != null && data.high !== undefined) {
      changed = changed || high > yMax;
    }
    if (data.volume != null) {
      changed = changed || data.volume > this.volMax;
    }

    if (low != null) {
      this.yMin = Math.min(yMin, low);
    }
    if (high != null) {
      this.yMax = Math.max(yMax, high);
    }

    yMin = this.yMin - (this.yMax - this.yMin) * this.bottomOffset;
    yMax = this.yMax + (this.yMax - this.yMin) * this.topOffset;

    this.yMin = yMin;
    this.yMax = yMax;

    if (data.volume != null) {
      this.volMax = Math.max(this.volMax, data.volume);
    }
    this.syncScales();

    return changed;
  }
}
