import {
  ChartSyncPlugin,
  DrawingManager,
  FinancialChart,
  LineController,
  MovingAverageIndicator,
  TrendLine,
  type ChartData,
  type ChartOptions,
  type ChartState
} from "@ardinsys/financial-charts";

const data: ChartData[] = [{ time: 0, close: 1 }];
const options: ChartOptions = {
  type: LineController.ID,
  stepSize: 60_000
};
const state = {} as ChartState;

void [
  ChartSyncPlugin,
  DrawingManager,
  FinancialChart,
  LineController,
  MovingAverageIndicator,
  TrendLine,
  data,
  options,
  state
];

// @ts-expect-error Package internals are not public subpaths.
void import("@ardinsys/financial-charts/src/chart/financial-chart");
