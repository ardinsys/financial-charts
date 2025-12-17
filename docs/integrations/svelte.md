# Svelte

Use `onMount`/`onDestroy` to wire the chart to a DOM node. Register controllers in a shared module so HMR does not duplicate them.

```ts
// controllers.ts
import {
  FinancialChart,
  AreaController,
  LineController,
  BarController,
  HollowCandleController,
  CandlestickController,
  SteplineController,
  HLCAreaController,
} from "@ardinsys/financial-charts";

let controllersRegistered = false;

export function registerControllers() {
  if (controllersRegistered) return;

  FinancialChart.registerController(AreaController);
  FinancialChart.registerController(LineController);
  FinancialChart.registerController(BarController);
  FinancialChart.registerController(HollowCandleController);
  FinancialChart.registerController(CandlestickController);
  FinancialChart.registerController(SteplineController);
  FinancialChart.registerController(HLCAreaController);

  controllersRegistered = true;
}
```

```svelte
<!-- Chart.svelte -->
<script lang="ts">
  import type { ChartData } from "@ardinsys/financial-charts";
  import { FinancialChart } from "@ardinsys/financial-charts";
  import "@ardinsys/financial-charts/dist/style.css";
  import { onDestroy, onMount } from "svelte";
  import { registerControllers } from "./controllers";

  export let data: ChartData[] = [];
  export let locale: string = "en";
  const localeValues = {
    en: {
      indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } },
      common: { sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" } }
    }
  };

  let container: HTMLDivElement | null = null;
  let chart: FinancialChart | null = null;
  let lastTimestamp: number | null = null;

  onMount(() => {
    registerControllers();
    if (!container) return;

    chart = new FinancialChart(container, "auto", {
      type: "line",
      stepSize: 5 * 60 * 1000,
      maxZoom: 200,
      volume: true
    });

    chart.draw(data);
    lastTimestamp = data.at(-1)?.time ?? null;
    chart.updateLocale(locale, localeValues);
  });

  $: if (chart) {
    const next = data.at(-1);

    if (next && lastTimestamp && next.time > lastTimestamp) {
      chart.drawNextPoint(next);
    } else {
      chart.draw(data);
    }

    lastTimestamp = next?.time ?? null;
  }

  $: if (chart) {
    chart.updateLocale(locale, localeValues);
  }

  onDestroy(() => chart?.dispose());
</script>

<div bind:this={container} style="height: 400px;"></div>
```

- Svelte's reactive statements let you push new data or stream updates when props change.
- Keep one `data` array. If you derive it upstream, keep it memoized to avoid redundant `draw` calls on unchanged feeds.
- Keep the container in the DOM – if the component is hidden or unmounted, dispose the chart to release observers.
