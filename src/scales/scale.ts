import { pixelRatio } from "../utils/screen";

export interface ScaleCanvas {
  width: number;
  height: number;
}

export interface ScaleProjectOptions {
  canvas: ScaleCanvas;
  devicePixelRatio?: number;
  zoomLevel?: number;
  panOffset?: number;
}

export interface ScaleTick {
  value: number;
  position: number;
  label?: string;
}

export interface ScaleTickOptions {
  canvas: ScaleCanvas;
  devicePixelRatio?: number;
}

export interface Scale {
  project(value: number, options: ScaleProjectOptions): number;
  unproject(pixel: number, options: ScaleProjectOptions): number;
  getTicks(options: ScaleTickOptions): ScaleTick[];
}

export function resolveDevicePixelRatio(options: {
  devicePixelRatio?: number;
}) {
  return options.devicePixelRatio ?? pixelRatio();
}
