import type {
  ChartData,
  ChartOptions,
  FinancialChart,
} from "@ardinsys/financial-charts";
import type {
  ChartDOMAdapter,
  IndicatorLabelActions,
  IndicatorLabelModel,
  PaneDividerModel,
} from "@ardinsys/financial-charts/extensions";
import type { Component } from "vue";

export interface IndicatorLabelRendererProps {
  readonly model: IndicatorLabelModel;
  readonly actions: IndicatorLabelActions;
}

export type IndicatorLabelRenderer = Component;

export interface PaneDividerRendererProps {
  readonly model: PaneDividerModel;
}

export type PaneDividerRenderer = Component;

export type IndicatorLabelRendererMap = Readonly<
  Record<string, IndicatorLabelRenderer>
>;

export interface VueDOMAdapterOptions {
  /** Adapter used for the overlay and for views without a Vue renderer. */
  fallback?: ChartDOMAdapter;
  /** Renderer used when `indicatorLabels` has no matching `labelKey`. */
  indicatorLabel?: IndicatorLabelRenderer;
  /** Indicator-label renderers keyed by `IndicatorLabelModel.labelKey`. */
  indicatorLabels?: IndicatorLabelRendererMap;
  paneDivider?: PaneDividerRenderer;
}

export interface FinancialChartProps {
  readonly options: ChartOptions;
  readonly data?: readonly ChartData[];
  readonly indicatorLabel?: IndicatorLabelRenderer;
  readonly indicatorLabels?: IndicatorLabelRendererMap;
  readonly paneDivider?: PaneDividerRenderer;
}

export interface FinancialChartExposed {
  readonly chart: FinancialChart | undefined;
}
