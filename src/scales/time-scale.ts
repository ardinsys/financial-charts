import {
  Scale,
  ScaleProjectOptions,
  ScaleTick,
  ScaleTickOptions,
  resolveDevicePixelRatio,
} from "./scale";

export interface TimeScaleRange {
  start: number;
  end: number;
}

export class TimeScale implements Scale {
  constructor(private range: TimeScaleRange) {}

  setRange(range: TimeScaleRange) {
    this.range = range;
  }

  getRange() {
    return this.range;
  }

  project(time: number, options: ScaleProjectOptions): number {
    const ratio = resolveDevicePixelRatio(options);
    const width = options.canvas.width / ratio;
    const zoomLevel = options.zoomLevel ?? 1;
    const panOffset = options.panOffset ?? 0;

    return (
      (((time - this.range.start) / (this.range.end - this.range.start)) *
        width -
        panOffset) *
      zoomLevel
    );
  }

  unproject(pixel: number, options: ScaleProjectOptions): number {
    const ratio = resolveDevicePixelRatio(options);
    const width = options.canvas.width / ratio;
    const zoomLevel = options.zoomLevel ?? 1;
    const panOffset = options.panOffset ?? 0;

    return (
      ((pixel / zoomLevel + panOffset) / width) *
        (this.range.end - this.range.start) +
      this.range.start
    );
  }

  getTicks(_options: ScaleTickOptions): ScaleTick[] {
    return [];
  }
}
