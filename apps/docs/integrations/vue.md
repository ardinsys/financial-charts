# Vue 3+

Install the official Vue integration alongside the core package:

```bash
pnpm add @ardinsys/financial-charts @ardinsys/financial-charts-vue
```

The component owns chart creation and disposal, applies runtime option changes,
and replaces chart data when the array reference changes.

```vue
<script setup lang="ts">
import { reactive, ref } from "vue";
import type { ChartData, ChartOptions } from "@ardinsys/financial-charts";
import {
  FinancialChart,
  type FinancialChartExposed,
} from "@ardinsys/financial-charts-vue";
import "@ardinsys/financial-charts/style.css";

const props = defineProps<{
  data: readonly ChartData[];
}>();

const chart = ref<FinancialChartExposed>();
const options = reactive<ChartOptions>({
  timeRange: "auto",
  type: "hlc-area",
  stepSize: 15 * 60 * 1000,
  maxZoom: 150,
  volume: true,
  theme: "dark",
});

function updateLiveData(point: ChartData) {
  chart.value?.chart?.updateData(point);
}
</script>

<template>
  <FinancialChart
    ref="chart"
    class="chart"
    :options="options"
    :data="props.data"
  />
</template>

<style scoped>
.chart {
  height: 400px;
}
</style>
```

- Runtime fields such as theme, locale, time range, and chart type are applied
  through `updateOptions()` without recreating the chart.
- Changing controllers, registered themes, or the core DOM adapter recreates
  the chart because those are construction-time dependencies.
- Replace the `data` array for a new snapshot. Do not deeply watch or mutate a
  large array in place.
- Send a live candle directly to `chart.value?.chart?.updateData(point)` instead
  of routing it through Vue rendering.
- The component renders only its host during SSR and constructs the chart in
  `onMounted()`.

## Custom indicator labels

Custom labels remain inside the application's Vue tree through Teleport, so
they can use provide/inject, application localization, stores, and component
libraries normally.

```vue
<!-- OrderIndicatorLabel.vue -->
<script setup lang="ts">
import type { IndicatorLabelRendererProps } from "@ardinsys/financial-charts-vue";

defineProps<IndicatorLabelRendererProps>();
</script>

<template>
  <div class="order-label" :data-theme="model.themeKey">
    <button type="button" @click="actions.onToggleVisibility(!model.visible)">
      {{ model.name }} {{ model.detail }}
    </button>

    <span
      v-for="(segment, index) in model.segments"
      :key="index"
      :style="{ color: segment.color }"
    >
      {{ segment.text }}
    </span>

    <button
      v-if="model.actions.canRemove"
      type="button"
      :aria-label="model.actionTitles.remove"
      @click="actions.onRemove"
    >
      ×
    </button>
  </div>
</template>
```

Register it using the indicator's stable `labelKey`:

```vue
<script setup lang="ts">
import OrderIndicatorLabel from "./OrderIndicatorLabel.vue";

const indicatorLabels = {
  orders: OrderIndicatorLabel,
};
</script>

<template>
  <FinancialChart
    :options="options"
    :data="data"
    :indicator-labels="indicatorLabels"
  />
</template>
```

Labels without a matching component continue using the default core renderer.
