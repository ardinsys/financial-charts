import type { RenderLayer } from "./render-pipeline";

export type ChartCanvasLayer =
  | "main"
  | "crosshair"
  | "x-label"
  | "y-label"
  | "indicator"
  | "drawings";

export type ChartRedrawPart = RenderLayer;
