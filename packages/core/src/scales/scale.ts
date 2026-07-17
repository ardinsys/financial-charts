import { pixelRatio } from "../utils/screen";

export interface ScaleCanvas {
  readonly width: number;
  readonly height: number;
}

export interface ScaleProjectOptions {
  readonly canvas: ScaleCanvas;
  readonly devicePixelRatio?: number;
  readonly barAlignment?: "center" | "edge";
}

export interface Scale {
  project(value: number, options: ScaleProjectOptions): number;
  unproject(pixel: number, options: ScaleProjectOptions): number;
}

export function resolveDevicePixelRatio(options: {
  devicePixelRatio?: number;
}) {
  return options.devicePixelRatio ?? pixelRatio();
}
