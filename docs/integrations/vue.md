# Vue 3+

Use refs plus `onMounted`/`onBeforeUnmount` to manage the chart. Built-in chart types are available by default on each chart instance.

```vue
<template>
  <div ref="container" class="chart"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { FinancialChart, type ChartData } from "@ardinsys/financial-charts";
import "@ardinsys/financial-charts/style.css";

const props = defineProps<{ data: readonly ChartData[] }>();
const appLocale = ref("en");
const localeValues = {
  en: {
    indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } },
    common: { sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" } }
  }
};

const container = ref<HTMLElement | null>(null);
const chart = ref<FinancialChart | null>(null);

onMounted(() => {
  if (!container.value) return;

  const instance = new FinancialChart(container.value, {
    timeRange: "auto",
    type: "hlc-area",
    stepSize: 15 * 60 * 1000,
    maxZoom: 150,
    volume: true,
  });

  instance.setData(props.data);
  chart.value = instance;

  chart.value.updateOptions({
    locale: appLocale.value,
    localeValues
  });
});

watch(
  () => props.data,
  (data) => {
    chart.value?.setData(data);
  }
);

watch(appLocale, (locale) => {
  chart.value?.updateOptions({
    locale,
    localeValues
  });
});

onBeforeUnmount(() => {
  chart.value?.dispose();
  chart.value = null;
});
</script>

<style scoped>
.chart {
  height: 400px;
}
</style>
```

- Avoid creating the chart before the container is measurable (e.g. inside collapsed tabs).
- Keep the `FinancialChart` instance outside of reactive renders to prevent re-creation.
- Replace the `data` array when its snapshot changes; avoid a deep watcher over
  thousands of bars. For a single-candle live feed, call `updateData(point)` at
  the feed boundary.
- Drive theme or controller changes through `chart.value.updateOptions(...)` in event handlers.
- In Nuxt or another SSR setup, keep construction inside a client-only mounted
  hook.
