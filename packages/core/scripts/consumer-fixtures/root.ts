import {
  ChartSyncPlugin,
  DrawingManager,
  FinancialChart,
  LineController,
  MovingAverageIndicator,
  TrendLine,
  type ChartCrosshairOptions,
  type ChartData,
  type ChartOptions,
  type ChartState,
  type ChartStateContributor,
  type DrawingMutationOptions,
  type DrawingSelectionOptions,
  type IndicatorMutationOptions,
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
// @ts-expect-error Render-layer contracts use the extensions entry.
import type { ChartRedrawPart } from "@ardinsys/financial-charts";

const data: ChartData[] = [{ time: 0, close: 1 }];
const options: ChartOptions = {
  type: LineController.ID,
  stepSize: 60_000,
};
const state = {} as ChartState;
const drawingMutation = {} as DrawingMutationOptions;
const drawingSelection = {} as DrawingSelectionOptions;
const indicatorMutation = {} as IndicatorMutationOptions;
const crosshairOptions: ChartCrosshairOptions = { time: 0 };
const chart = null as unknown as FinancialChart;
const contributor: ChartStateContributor<{ symbol: string }> = {
  key: "symbol",
  toJSON: () => ({ symbol: "AAPL" }),
  fromJSON: (_state) => undefined,
};
const serializedState = chart.toJSON({ contributors: [contributor] });

// @ts-expect-error v1 uses setData() for full data replacement.
chart.draw(data);
// @ts-expect-error v1 uses updateData() for streaming updates.
chart.drawNextPoint(data[0]);
// @ts-expect-error v1 uses updateOptions() for runtime option changes.
chart.updateCoreOptions("auto", 60_000, 10);
// @ts-expect-error Render invalidation belongs to extension contexts.
chart.requestRedraw("series");
// @ts-expect-error Canvas access belongs to controller and extension contexts.
chart.getContext("main");
// @ts-expect-error Render caches are engine state.
chart.getLastVisibleDataPoints();
// @ts-expect-error Render caches are engine state.
chart.getLastXGridCoords();
// @ts-expect-error Indicator grouping belongs to extension contexts.
chart.getPaneledIndicators();
// @ts-expect-error getIndicators() is the complete public collection.
chart.getAllIndicators();
// @ts-expect-error Pane heights are included in getPanes() snapshots.
chart.getPaneHeights();
// @ts-expect-error Runtime changes use updateOptions().
chart.changeType("line");
// @ts-expect-error Runtime changes use updateOptions().
chart.setVolumeDraw(false);
// @ts-expect-error Runtime changes use updateOptions().
chart.updateLocalization({ locale: "en-US" });

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
  indicatorMutation,
  crosshairOptions,
  contributor,
  serializedState,
  chart,
];
void [
  null as unknown as Indicator,
  null as unknown as ChartPlugin,
  null as unknown as ChartRedrawPart,
  null as unknown as DataScaleModel,
  TestIndicator,
  ICON_SHOW,
  defaultControllers,
];

// @ts-expect-error Package internals are not public subpaths.
void import("@ardinsys/financial-charts/src/chart/financial-chart");
