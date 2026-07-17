import type { ChartData } from "../chart/types";

export interface ChartCrosshairOptions {
  /** Timestamp to resolve on the target chart. The nearest data point is used. */
  time: number;
  /** Chart-relative logical Y coordinate. */
  y?: number;
  /** Price to project inside the target pane when `y` is omitted. */
  price?: number;
  /** Target pane id. Defaults to the main pane. */
  paneId?: number;
}

export interface ChartCrosshairState {
  readonly time: number;
  readonly y: number;
  readonly paneId: number;
  readonly price: number;
  readonly dataPoint: ChartData;
}
