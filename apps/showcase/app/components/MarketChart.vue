<script setup lang="ts">
import {
  MovingAverageIndicator,
  type ChartData,
  type ChartOptions,
  type ControllerType,
  type FinancialChart,
} from "@ardinsys/financial-charts";
import { FinancialChart as VueFinancialChart } from "@ardinsys/financial-charts-vue";
import {
  showcaseChartLocale,
  showcaseChartLocaleValues,
} from "~/utils/chart-locale";
import { showcaseChartThemes, showcaseThemeKey } from "~/utils/chart-theme";
import {
  createMarketData,
  nextMarketPoint,
  STEP_SIZE,
} from "~/utils/market-data";

const props = withDefaults(
  defineProps<{
    type?: ControllerType;
    compact?: boolean;
    live?: boolean;
    seed?: number;
    volume?: boolean;
    indicator?: boolean;
  }>(),
  {
    type: "candle",
    compact: false,
    live: false,
    seed: 7,
    volume: false,
    indicator: false,
  }
);

const colorMode = useColorMode();
const { locale } = useSiteLocale();
const initialData = shallowRef<ChartData[]>([]);
const chart = shallowRef<FinancialChart>();
const settingsIndicator = shallowRef<MovingAverageIndicator>();
let data: ChartData[] = [];
let liveTimer: ReturnType<typeof setInterval> | undefined;
let disposeSettingsListener: (() => void) | undefined;

const options = computed<ChartOptions>(() => ({
  stepSize: STEP_SIZE,
  timeRange: "auto",
  type: props.type,
  maxZoom: props.compact ? 58 : 88,
  wheelZoom: "modifier",
  volume: props.volume,
  locale: showcaseChartLocale(locale.value),
  timeZone: "Europe/Budapest",
  localeValues: showcaseChartLocaleValues,
  theme: showcaseThemeKey(colorMode.value),
  themes: showcaseChartThemes,
}));

function onReady(instance: FinancialChart) {
  disposeSettingsListener?.();
  settingsIndicator.value = undefined;
  chart.value = instance;
  disposeSettingsListener = instance.on(
    "indicator-settings-open",
    ({ indicator }) => {
      if (indicator instanceof MovingAverageIndicator) {
        settingsIndicator.value = indicator;
      }
    }
  );
  if (props.indicator) {
    instance.addIndicator(
      new MovingAverageIndicator(null, {
        period: 9,
        names: {
          default: "Simple Moving Average",
          "en-US": "Simple Moving Average",
        },
      })
    );
  }
}

onMounted(() => {
  data = createMarketData(props.compact ? 52 : 96, STEP_SIZE, props.seed);
  initialData.value = data;

  if (props.live) {
    liveTimer = setInterval(() => {
      const point = nextMarketPoint(data, STEP_SIZE, props.seed);
      data = [...data.slice(-110), point];
      chart.value?.updateData(point);
    }, 1200);
  }
});

onBeforeUnmount(() => {
  if (liveTimer) clearInterval(liveTimer);
  disposeSettingsListener?.();
  chart.value = undefined;
  settingsIndicator.value = undefined;
});
</script>

<template>
  <VueFinancialChart
    class="market-chart"
    :options="options"
    :data="initialData"
    @ready="onReady"
  />
  <IndicatorSettingsDialog
    v-if="props.indicator"
    :indicator="settingsIndicator"
    @close="settingsIndicator = undefined"
  />
</template>
