import {
  FinancialChart as FinancialChartInstance,
  type ChartData,
  type ChartOptions,
  type ChartOptionsUpdate,
  type TimeRange,
} from "@ardinsys/financial-charts";
import {
  Fragment,
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactElement,
} from "react";
import type {
  FinancialChartHandle,
  FinancialChartProps,
  IndicatorLabelRendererMap,
  ReactDOMAdapterOptions,
} from "./types";
import { ReactDOMAdapter } from "./react-dom-adapter";
import { ReactDOMPortals } from "./react-dom-portals";

interface RuntimeOptionsSnapshot extends ChartOptionsUpdate {
  stepSize: number;
}

interface CurrentProps {
  readonly options: ChartOptions;
  readonly data?: readonly ChartData[];
  readonly adapter?: ReactDOMAdapter;
  readonly onReady?: (chart: FinancialChartInstance) => void;
}

const EMPTY_DATA: readonly ChartData[] = [];

export const FinancialChart = forwardRef<
  FinancialChartHandle,
  FinancialChartProps
>(function FinancialChart(
  {
    options,
    data,
    indicatorLabel,
    indicatorLabels,
    paneDivider,
    onReady,
    ...hostProps
  },
  ref
): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<FinancialChartInstance | undefined>(undefined);
  const appliedDataRef = useRef<readonly ChartData[] | undefined>(undefined);
  const previousRuntimeOptionsRef = useRef(takeRuntimeOptions(options));
  const stableIndicatorLabels = useStableRendererMap(indicatorLabels);
  const adapter = useMemo(
    () =>
      createReactDOMAdapter({
        fallback: options.domAdapter,
        indicatorLabel,
        indicatorLabels: stableIndicatorLabels,
        paneDivider,
      }),
    [options.domAdapter, indicatorLabel, stableIndicatorLabels, paneDivider]
  );
  const currentPropsRef = useRef<CurrentProps>({
    options,
    data,
    adapter,
    onReady,
  });
  currentPropsRef.current = { options, data, adapter, onReady };

  const destroyChart = useCallback(() => {
    const chart = chartRef.current;
    chartRef.current = undefined;
    appliedDataRef.current = undefined;
    chart?.dispose();
  }, []);

  const replaceChart = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    destroyChart();

    const current = currentPropsRef.current;
    const chartOptions = current.adapter
      ? { ...current.options, domAdapter: current.adapter }
      : current.options;
    const chart = new FinancialChartInstance(host, chartOptions);

    chartRef.current = chart;
    previousRuntimeOptionsRef.current = takeRuntimeOptions(current.options);
    const initialData = current.data ?? EMPTY_DATA;
    appliedDataRef.current = initialData;
    chart.setData(initialData);
    current.onReady?.(chart);
  }, [destroyChart]);

  useImperativeHandle(
    ref,
    () => ({
      get chart() {
        return chartRef.current;
      },
    }),
    []
  );

  useEffect(() => {
    replaceChart();
    return destroyChart;
  }, [
    replaceChart,
    destroyChart,
    adapter,
    options.controllers,
    options.includeDefaultControllers,
    options.themes,
    options.domAdapter,
  ]);

  useEffect(() => {
    const next = takeRuntimeOptions(options);
    const previous = previousRuntimeOptionsRef.current;
    if (requiresRecreation(previous, next)) {
      replaceChart();
      return;
    }

    const update = diffRuntimeOptions(previous, next);
    previousRuntimeOptionsRef.current = next;
    if (Object.keys(update).length > 0) {
      chartRef.current?.updateOptions(update);
    }
  }, [
    replaceChart,
    options.type,
    rangeStart(options.timeRange),
    rangeEnd(options.timeRange),
    options.stepSize,
    options.maxZoom,
    options.volume,
    options.theme,
    options.locale,
    options.timeZone,
    options.formatter,
    options.localeValues,
  ]);

  useEffect(() => {
    const nextData = data ?? EMPTY_DATA;
    if (appliedDataRef.current === nextData) return;
    chartRef.current?.setData(nextData);
    appliedDataRef.current = nextData;
  }, [data]);

  return createElement(
    Fragment,
    null,
    createElement("div", { ...hostProps, ref: hostRef }),
    adapter ? createElement(ReactDOMPortals, { adapter }) : null
  );
});

function createReactDOMAdapter(
  options: ReactDOMAdapterOptions
): ReactDOMAdapter | undefined {
  if (
    !options.indicatorLabel &&
    !options.indicatorLabels &&
    !options.paneDivider
  ) {
    return undefined;
  }

  return new ReactDOMAdapter(options);
}

function useStableRendererMap(
  renderers: IndicatorLabelRendererMap | undefined
): IndicatorLabelRendererMap | undefined {
  const stable = useRef(renderers);
  if (!rendererMapsEqual(stable.current, renderers)) {
    stable.current = renderers;
  }
  return stable.current;
}

function takeRuntimeOptions(options: ChartOptions): RuntimeOptionsSnapshot {
  return {
    type: options.type,
    timeRange: options.timeRange,
    stepSize: options.stepSize,
    maxZoom: options.maxZoom,
    volume: options.volume,
    theme: options.theme,
    locale: options.locale,
    timeZone: options.timeZone,
    formatter: options.formatter,
    localeValues: options.localeValues,
  };
}

function diffRuntimeOptions(
  previous: RuntimeOptionsSnapshot,
  next: RuntimeOptionsSnapshot
): ChartOptionsUpdate {
  const update: ChartOptionsUpdate = {};
  if (previous.type !== next.type) update.type = next.type;
  if (!timeRangesEqual(previous.timeRange, next.timeRange)) {
    update.timeRange = next.timeRange;
  }
  if (previous.stepSize !== next.stepSize) update.stepSize = next.stepSize;
  if (previous.maxZoom !== next.maxZoom) update.maxZoom = next.maxZoom;
  if (previous.volume !== next.volume) update.volume = next.volume;
  if (previous.theme !== next.theme) update.theme = next.theme;
  if (previous.locale !== next.locale) update.locale = next.locale;
  if (previous.timeZone !== next.timeZone) update.timeZone = next.timeZone;
  if (previous.formatter !== next.formatter) update.formatter = next.formatter;
  if (previous.localeValues !== next.localeValues) {
    update.localeValues = next.localeValues;
  }
  return update;
}

function requiresRecreation(
  previous: RuntimeOptionsSnapshot,
  next: RuntimeOptionsSnapshot
): boolean {
  return (
    wasRemoved(previous.type, next.type) ||
    wasRemoved(previous.timeRange, next.timeRange) ||
    wasRemoved(previous.maxZoom, next.maxZoom) ||
    wasRemoved(previous.volume, next.volume) ||
    wasRemoved(previous.theme, next.theme) ||
    wasRemoved(previous.locale, next.locale) ||
    wasRemoved(previous.formatter, next.formatter) ||
    wasRemoved(previous.localeValues, next.localeValues)
  );
}

function wasRemoved(previous: unknown, next: unknown): boolean {
  return previous !== undefined && next === undefined;
}

function rangeStart(
  range: TimeRange | "auto" | undefined
): number | string | undefined {
  return range === "auto" ? range : range?.start;
}

function rangeEnd(
  range: TimeRange | "auto" | undefined
): number | string | undefined {
  return range === "auto" ? range : range?.end;
}

function timeRangesEqual(
  left: TimeRange | "auto" | undefined,
  right: TimeRange | "auto" | undefined
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left === "auto" || right === "auto") return left === right;
  return left.start === right.start && left.end === right.end;
}

function rendererMapsEqual(
  left: IndicatorLabelRendererMap | undefined,
  right: IndicatorLabelRendererMap | undefined
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => left[key] === right[key])
  );
}
