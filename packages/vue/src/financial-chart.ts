import {
  FinancialChart as FinancialChartInstance,
  type ChartData,
  type ChartOptions,
  type ChartOptionsUpdate,
  type TimeRange,
} from "@ardinsys/financial-charts";
import {
  defineComponent,
  h,
  markRaw,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  watch,
  type PropType,
} from "vue";
import type {
  FinancialChartExposed,
  IndicatorLabelRenderer,
  IndicatorLabelRendererMap,
  PaneDividerRenderer,
} from "./types";
import { VueDOMAdapter } from "./vue-dom-adapter";
import { VueDOMPortals } from "./vue-dom-portals";

interface RuntimeOptionsSnapshot extends ChartOptionsUpdate {
  stepSize: number;
}

export const FinancialChart = defineComponent({
  name: "FinancialChart",
  inheritAttrs: false,
  props: {
    options: {
      type: Object as PropType<ChartOptions>,
      required: true,
    },
    data: {
      type: Array as PropType<readonly ChartData[]>,
      default: undefined,
    },
    indicatorLabel: {
      type: [Object, Function] as PropType<IndicatorLabelRenderer>,
      default: undefined,
    },
    indicatorLabels: {
      type: Object as PropType<IndicatorLabelRendererMap>,
      default: undefined,
    },
    paneDivider: {
      type: [Object, Function] as PropType<PaneDividerRenderer>,
      default: undefined,
    },
  },
  emits: {
    ready: (_chart: FinancialChartInstance) => true,
  },
  setup(props, { attrs, emit, expose }) {
    const host = shallowRef<HTMLElement>();
    const chart = shallowRef<FinancialChartInstance>();
    const vueDOMAdapter = shallowRef<VueDOMAdapter>();
    let previousRuntimeOptions = takeRuntimeOptions(props.options);
    let previousIndicatorLabels = props.indicatorLabels;

    const exposed: FinancialChartExposed = {
      get chart() {
        return chart.value;
      },
    };
    expose(exposed);

    const destroyChart = () => {
      const current = chart.value;
      chart.value = undefined;
      current?.dispose();
      vueDOMAdapter.value = undefined;
    };

    const createChart = () => {
      if (!host.value) return;
      destroyChart();

      const adapter = createVueDOMAdapter(props);
      vueDOMAdapter.value = adapter;
      const options: ChartOptions = adapter
        ? { ...props.options, domAdapter: adapter }
        : props.options;
      const instance = markRaw(new FinancialChartInstance(host.value, options));

      chart.value = instance;
      previousRuntimeOptions = takeRuntimeOptions(props.options);
      instance.setData(props.data ?? []);
      emit("ready", instance);
    };

    onMounted(createChart);
    onBeforeUnmount(destroyChart);

    watch(
      [
        () => props.options.controllers,
        () => props.options.includeDefaultControllers,
        () => props.options.themes,
        () => props.options.domAdapter,
        () => props.indicatorLabel,
        () => props.paneDivider,
      ],
      createChart,
    );

    watch(
      () => props.indicatorLabels,
      (next) => {
        if (rendererMapsEqual(previousIndicatorLabels, next)) return;
        previousIndicatorLabels = next;
        createChart();
      },
    );

    watch(
      [
        () => props.options.type,
        () => rangeStart(props.options.timeRange),
        () => rangeEnd(props.options.timeRange),
        () => props.options.stepSize,
        () => props.options.maxZoom,
        () => props.options.volume,
        () => props.options.theme,
        () => props.options.locale,
        () => props.options.timeZone,
        () => props.options.formatter,
        () => props.options.localeValues,
      ],
      () => {
        const next = takeRuntimeOptions(props.options);
        if (requiresRecreation(previousRuntimeOptions, next)) {
          createChart();
          return;
        }

        const update = diffRuntimeOptions(previousRuntimeOptions, next);
        previousRuntimeOptions = next;
        if (Object.keys(update).length > 0) {
          chart.value?.updateOptions(update);
        }
      },
    );

    watch(
      () => props.data,
      (data) => {
        chart.value?.setData(data ?? []);
      },
    );

    return () => [
      h("div", { ...attrs, ref: host }),
      vueDOMAdapter.value
        ? h(VueDOMPortals, { adapter: vueDOMAdapter.value })
        : null,
    ];
  },
});

function createVueDOMAdapter(props: {
  readonly options: ChartOptions;
  readonly indicatorLabel?: IndicatorLabelRenderer;
  readonly indicatorLabels?: IndicatorLabelRendererMap;
  readonly paneDivider?: PaneDividerRenderer;
}): VueDOMAdapter | undefined {
  if (!props.indicatorLabel && !props.indicatorLabels && !props.paneDivider) {
    return undefined;
  }

  return markRaw(
    new VueDOMAdapter({
      fallback: props.options.domAdapter,
      indicatorLabel: props.indicatorLabel,
      indicatorLabels: props.indicatorLabels,
      paneDivider: props.paneDivider,
    }),
  );
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
  next: RuntimeOptionsSnapshot,
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
  next: RuntimeOptionsSnapshot,
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
  range: TimeRange | "auto" | undefined,
): number | string | undefined {
  return range === "auto" ? range : range?.start;
}

function rangeEnd(
  range: TimeRange | "auto" | undefined,
): number | string | undefined {
  return range === "auto" ? range : range?.end;
}

function timeRangesEqual(
  left: TimeRange | "auto" | undefined,
  right: TimeRange | "auto" | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left === "auto" || right === "auto") return left === right;
  return left.start === right.start && left.end === right.end;
}

function rendererMapsEqual(
  left: IndicatorLabelRendererMap | undefined,
  right: IndicatorLabelRendererMap | undefined,
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
