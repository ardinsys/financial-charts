# Vue 3+

Use refs plus `onMounted`/`onBeforeUnmount` to manage the chart. Reuse the controller registration helper from the React example (or any module-level file) so it only runs once.

```vue
<template>
  <div ref="container" class="chart"></div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { FinancialChart, type ChartData } from "@ardinsys/financial-charts";
import "@ardinsys/financial-charts/dist/style.css";
import { registerControllers } from "./controllers";

const props = defineProps<{ data: ChartData[]; latest?: ChartData }>();
const appLocale = ref("en"); // replace with your i18n store value
const localeValues = {
  en: {
    indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } },
    common: { sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" } }
  }
};

const container = ref<HTMLElement | null>(null);
const chart = ref<FinancialChart | null>(null);

onMounted(() => {
  registerControllers();
  if (!container.value) return;

  const instance = new FinancialChart(container.value, "auto", {
    type: "hlc-area",
    stepSize: 15 * 60 * 1000,
    maxZoom: 150,
    volume: true,
  });

  instance.draw(props.data);
  chart.value = instance;

  chart.value.updateLocale(appLocale.value, localeValues);
});

watch(
  () => props.data,
  (data) => chart.value?.draw(data),
  { deep: true }
);

watch(
  () => props.latest,
  (point) => point && chart.value?.drawNextPoint(point)
);

watch(appLocale, (locale) => {
  chart.value?.updateLocale(locale, localeValues);
});

onBeforeUnmount(() => chart.value?.dispose());
</script>

<style scoped>
.chart {
  height: 400px;
}
</style>
```

- Avoid creating the chart before the container is measurable (e.g. inside collapsed tabs).
- Keep the `FinancialChart` instance outside of reactive renders to prevent re-creation.
- Drive theme or controller changes via methods on `chart.value` in event handlers.
