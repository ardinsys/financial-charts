export interface ChartData {
  time: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
}

export interface TimeRange {
  start: number;
  end: number;
}

export type AxisLabel = {
  value: number;
  position: number;
};
