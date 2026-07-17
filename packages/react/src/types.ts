import type {
  ChartData,
  ChartOptions,
  FinancialChart as FinancialChartInstance,
} from "@ardinsys/financial-charts";
import type {
  ChartDOMAdapter,
  IndicatorLabelActions,
  IndicatorLabelModel,
  PaneDividerModel,
} from "@ardinsys/financial-charts/extensions";
import type { ComponentType, HTMLAttributes } from "react";

export interface IndicatorLabelRendererProps {
  readonly model: IndicatorLabelModel;
  readonly actions: IndicatorLabelActions;
}

export type IndicatorLabelRenderer = ComponentType<IndicatorLabelRendererProps>;

export interface PaneDividerRendererProps {
  readonly model: PaneDividerModel;
}

export type PaneDividerRenderer = ComponentType<PaneDividerRendererProps>;

export type IndicatorLabelRendererMap = Readonly<
  Record<string, IndicatorLabelRenderer>
>;

export interface ReactDOMAdapterOptions {
  /** Adapter used for the overlay and for views without a React renderer. */
  fallback?: ChartDOMAdapter;
  /** Renderer used when `indicatorLabels` has no matching `labelKey`. */
  indicatorLabel?: IndicatorLabelRenderer;
  /** Indicator-label renderers keyed by `IndicatorLabelModel.labelKey`. */
  indicatorLabels?: IndicatorLabelRendererMap;
  paneDivider?: PaneDividerRenderer;
}

export interface FinancialChartProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  readonly options: ChartOptions;
  readonly data?: readonly ChartData[];
  readonly indicatorLabel?: IndicatorLabelRenderer;
  readonly indicatorLabels?: IndicatorLabelRendererMap;
  readonly paneDivider?: PaneDividerRenderer;
  readonly onReady?: (chart: FinancialChartInstance) => void;
}

export interface FinancialChartHandle {
  readonly chart: FinancialChartInstance | undefined;
}
