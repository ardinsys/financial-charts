/** One readonly financial-series observation. All present numbers must be finite. */
export interface ChartData {
  /** UNIX timestamp in milliseconds. */
  readonly time: number;
  readonly open?: number | null;
  readonly high?: number | null;
  readonly low?: number | null;
  readonly close?: number | null;
  readonly volume?: number | null;
}

export type ChartDataValueKey = Exclude<keyof ChartData, "time">;

export interface TimeRange {
  readonly start: number;
  readonly end: number;
}

export type AxisLabel = {
  readonly value: number;
  readonly position: number;
};
