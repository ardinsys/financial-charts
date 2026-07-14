import {
  Scale,
  ScaleProjectOptions,
  ScaleTick,
  ScaleTickOptions,
  resolveDevicePixelRatio,
} from "./scale";

export interface PriceScaleRange {
  readonly min: number;
  readonly max: number;
}

export class PriceScale implements Scale {
  private range: PriceScaleRange;

  constructor(range: PriceScaleRange) {
    this.range = freezeRange(range);
  }

  setRange(range: PriceScaleRange): void {
    this.range = freezeRange(range);
  }

  getRange(): PriceScaleRange {
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

    if (this.range.max <= 0) return 0;

    return (value / this.range.max) * maxColumnHeight;
  }

  getTicks(_options: ScaleTickOptions): ScaleTick[] {
    return [];
  }
}

function freezeRange(range: PriceScaleRange): PriceScaleRange {
  return Object.freeze({ ...range });
}
