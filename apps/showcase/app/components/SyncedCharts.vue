<script setup lang="ts">
import {
  ChartSyncPlugin,
  type ChartData,
  type ChartOptions,
  type FinancialChart,
} from "@ardinsys/financial-charts";
import { FinancialChart as VueFinancialChart } from "@ardinsys/financial-charts-vue";
import {
  showcaseChartLocale,
  showcaseChartLocaleValues,
} from "~/utils/chart-locale";
import { showcaseChartThemes, showcaseThemeKey } from "~/utils/chart-theme";
import { createMarketData, STEP_SIZE } from "~/utils/market-data";

const { copy, locale } = useSiteLocale();
const colorMode = useColorMode();
const group = `showcase-sync-${useId()}`;
const primaryData = shallowRef<ChartData[]>([]);
const contextData = shallowRef<ChartData[]>([]);

const primaryOptions = computed<ChartOptions>(() => ({
  stepSize: STEP_SIZE,
  timeRange: "auto",
  type: "candle",
  maxZoom: 70,
  wheelZoom: "modifier",
  locale: showcaseChartLocale(locale.value),
  timeZone: "Europe/Budapest",
  localeValues: showcaseChartLocaleValues,
  theme: showcaseThemeKey(colorMode.value),
  themes: showcaseChartThemes,
}));

const contextOptions = computed<ChartOptions>(() => ({
  stepSize: STEP_SIZE * 4,
  timeRange: "auto",
  type: "area",
  maxZoom: 34,
  wheelZoom: "modifier",
  locale: showcaseChartLocale(locale.value),
  timeZone: "Europe/Budapest",
  localeValues: showcaseChartLocaleValues,
  theme: showcaseThemeKey(colorMode.value),
  themes: showcaseChartThemes,
}));

function connectChart(chart: FinancialChart) {
  chart.addPlugin(
    new ChartSyncPlugin({
      group,
      drawings: false,
      indicators: false,
      paneHeights: false,
    })
  );
}

onMounted(() => {
  primaryData.value = createMarketData(94, STEP_SIZE, 8);
  contextData.value = createMarketData(72, STEP_SIZE * 4, 13, 181.4);
});

onBeforeUnmount(() => {
  ChartSyncPlugin.clearGroup(group);
});
</script>

<template>
  <div class="sync-stage instrument-panel" data-reveal>
    <div class="sync-header">
      <div>
        <span class="status-dot" />
        <strong>{{ copy.sync.badge }}</strong>
      </div>
      <span class="mono sync-hint">↔ {{ copy.sync.hint }}</span>
    </div>
    <div class="sync-chart primary-sync-chart">
      <div class="sync-label"><span>01</span>{{ copy.sync.primary }}</div>
      <VueFinancialChart
        class="market-chart"
        :options="primaryOptions"
        :data="primaryData"
        @ready="connectChart"
      />
    </div>
    <div class="sync-connector">
      <span /><i>{{ copy.sync.connection }}</i
      ><span />
    </div>
    <div class="sync-chart context-sync-chart">
      <div class="sync-label"><span>02</span>{{ copy.sync.context }}</div>
      <VueFinancialChart
        class="market-chart"
        :options="contextOptions"
        :data="contextData"
        @ready="connectChart"
      />
    </div>
  </div>
</template>
