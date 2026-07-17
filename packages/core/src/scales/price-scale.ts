import { Scale, ScaleProjectOptions, resolveDevicePixelRatio } from "./scale";

export interface PriceScaleRange {
  readonly min: number;
  readonly max: number;
}

export class PriceScale implements Scale {
  private range: PriceScaleRange;

  constructor(range: PriceScaleRange) {
    this.range = copyRange(range);
  }

  setRange(range: PriceScaleRange): void {
    if (this.range.min === range.min && this.range.max === range.max) return;
    this.range = copyRange(range);
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
      (1 - pixel / height) * (this.range.max - this.range.min) + this.range.min
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
}

function copyRange(range: PriceScaleRange): PriceScaleRange {
  return { ...range };
}
