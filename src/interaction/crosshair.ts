import type { ChartData } from "../chart/types";
import type { Pane } from "../panes/pane";

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
  time: number;
  y: number;
  pane: Pane;
  dataPoint: ChartData;
}
