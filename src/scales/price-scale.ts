import {
  Scale,
  ScaleProjectOptions,
  ScaleTick,
  ScaleTickOptions,
  resolveDevicePixelRatio,
} from "./scale";

export interface PriceScaleRange {
  min: number;
  max: number;
}

export class PriceScale implements Scale {
  constructor(private range: PriceScaleRange) {}

  setRange(range: PriceScaleRange) {
    this.range = range;
  }

  getRange() {
    return this.range;
  }

  project(value: number, options: ScaleProjectOptions): number {
    const ratio = resolveDevicePixelRatio(options);
    const height = options.canvas.height / ratio;

    return (
      (1 - (value - this.range.min) / (this.range.max - this.range.min)) *
      height
    );
  }

  unproject(pixel: number, options: ScaleProjectOptions): number {
    const ratio = resolveDevicePixelRatio(options);
    const height = options.canvas.height / ratio;

    return (
      (1 - pixel / height) * (this.range.max - this.range.min) +
      this.range.min
    );
  }

  projectVolume(
    value: number,
    options: ScaleProjectOptions,
    maxHeightRatio = 0.2
  ): number {
    const ratio = resolveDevicePixelRatio(options);
    const height = options.canvas.height / ratio;
    const maxColumnHeight = height * maxHeightRatio;

    return (value / this.range.max) * maxColumnHeight;
  }

  getTicks(_options: ScaleTickOptions): ScaleTick[] {
    return [];
  }
}
