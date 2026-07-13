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

const props = defineProps<{ data: ChartData[] }>();
const appLocale = ref("en"); // replace with your i18n store value
const localeValues = {
  en: {
    indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } },
    common: { sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" } }
  }
};

const container = ref<HTMLElement | null>(null);
const chart = ref<FinancialChart | null>(null);
const lastTimestamp = ref<number | null>(null);

onMounted(() => {
  if (!container.value) return;

  const instance = new FinancialChart(container.value, "auto", {
    type: "hlc-area",
    stepSize: 15 * 60 * 1000,
    maxZoom: 150,
    volume: true,
  });

  instance.setData(props.data);
  lastTimestamp.value = props.data.at(-1)?.time ?? null;
  chart.value = instance;

  chart.value.updateLocalization({
    locale: appLocale.value,
    localeValues
  });
});

watch(
  () => props.data,
  (data) => {
    if (!chart.value) return;
    const next = data.at(-1);
    const prev = lastTimestamp.value;

    if (next && prev && next.time > prev) {
      chart.value.updateData(next);
    } else {
      chart.value.setData(data);
    }

    lastTimestamp.value = next?.time ?? null;
  },
  { deep: true }
);

watch(appLocale, (locale) => {
  chart.value?.updateLocalization({
    locale,
    localeValues
  });
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
- Prefer one `data` array. Memoize or compute it in the parent so identical feeds don't trigger redundant `setData` calls.
- Drive theme or controller changes via methods on `chart.value` in event handlers.
