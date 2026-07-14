import {
  ChartSyncPlugin,
  DrawingManager,
  FinancialChart,
  LineController,
  MovingAverageIndicator,
  TrendLine,
  type ChartData,
  type ChartOptions,
  type ChartState,
  type DrawingMutationOptions,
  type DrawingSelectionOptions
} from "@ardinsys/financial-charts";

// @ts-expect-error Indicator authoring contracts use the extensions entry.
import type { Indicator } from "@ardinsys/financial-charts";
// @ts-expect-error Plugin authoring contracts use the extensions entry.
import type { ChartPlugin } from "@ardinsys/financial-charts";
// @ts-expect-error Scale contracts use the engine entry.
import type { DataScaleModel } from "@ardinsys/financial-charts";
// @ts-expect-error Test fixtures are not public API.
import { TestIndicator } from "@ardinsys/financial-charts";
// @ts-expect-error Adapter implementation assets are not public API.
import { ICON_SHOW } from "@ardinsys/financial-charts";
// @ts-expect-error The built-in controller registry is an implementation detail.
import { defaultControllers } from "@ardinsys/financial-charts";

const data: ChartData[] = [{ time: 0, close: 1 }];
const options: ChartOptions = {
  type: LineController.ID,
  stepSize: 60_000
};
const state = {} as ChartState;
const drawingMutation = {} as DrawingMutationOptions;
const drawingSelection = {} as DrawingSelectionOptions;
const chart = null as unknown as FinancialChart;

// @ts-expect-error v1 uses setData() for full data replacement.
chart.draw(data);
// @ts-expect-error v1 uses updateData() for streaming updates.
chart.drawNextPoint(data[0]);
// @ts-expect-error v1 uses updateOptions() for runtime option changes.
chart.updateCoreOptions("auto", 60_000, 10);
// @ts-expect-error Redraw requests name concrete render layers.
chart.requestRedraw("controller");

void [
  ChartSyncPlugin,
  DrawingManager,
  FinancialChart,
  LineController,
  MovingAverageIndicator,
  TrendLine,
  data,
  options,
  state,
  drawingMutation,
  drawingSelection,
  chart
];
void [
  null as unknown as Indicator,
  null as unknown as ChartPlugin,
  null as unknown as DataScaleModel,
  TestIndicator,
  ICON_SHOW,
  defaultControllers
];

// @ts-expect-error Package internals are not public subpaths.
void import("@ardinsys/financial-charts/src/chart/financial-chart");
