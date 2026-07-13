/**
 * One immutable financial-series observation. All present numbers must be
 * finite.
 */
export interface ChartData {
  /** UNIX timestamp in milliseconds. */
  readonly time: number;
  readonly open?: number | null;
  readonly high?: number | null;
  readonly low?: number | null;
  readonly close?: number | null;
  readonly volume?: number | null;
}

export interface TimeRange {
  start: number;
  end: number;
}

export type AxisLabel = {
  value: number;
  position: number;
};
