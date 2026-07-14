# Quick start

The root package provides a chart with every built-in controller registered.
Only `stepSize` is required; the root chart otherwise defaults to candlesticks,
automatic time range, volume enabled, `maxZoom: 100`, the light theme, and the
browser locale.

## Install

```bash
npm install @ardinsys/financial-charts
```

Import the package stylesheet once in your application. It styles the chart
container, indicator labels, controls, and pane dividers.

```ts
import "@ardinsys/financial-charts/style.css";
```

## Create and feed a chart

The container must have a measurable width and height. Construct the chart,
then replace its complete dataset with `setData()`.

```ts
import {
  FinancialChart,
  type ChartData
} from "@ardinsys/financial-charts";

const container = document.getElementById("chart-root")!;
const data: ChartData[] = [
  {
    time: Date.UTC(2024, 0, 1, 9),
    open: 11,
    high: 15,
    low: 10,
    close: 12,
    volume: 1_200_000
  },
  {
    time: Date.UTC(2024, 0, 1, 9, 15),
    open: 12,
    high: 16,
    low: 11,
    close: 15,
    volume: 1_500_000
  }
];

const chart = new FinancialChart(container, {
  stepSize: 15 * 60 * 1000
});

chart.setData(data);
```

`ChartData.time` is a finite millisecond timestamp. Price and volume fields are
optional and accept `null`; zero is always treated as a real value. `setData()`
copies, validates, sorts, buckets, and merges the input without mutating it.

## Stream updates

Use `updateData()` only for the newest observation. It can initialize an empty
chart, merge another observation into the latest `stepSize` bucket, or append a
new bucket while preserving the current view. Equal timestamps are accepted;
older timestamps throw and must be applied with `setData()`.

```ts
chart.updateData({
  time: Date.UTC(2024, 0, 1, 9, 30),
  open: 15,
  high: 17,
  low: 14,
  close: 16,
  volume: 900_000
});
```

Use `clearData()` or `setData([])` when the active symbol has no observations.

## Update runtime options

`updateOptions()` applies one validated patch and emits one `options-change`
event when effective values change.

```ts
import { defaultDarkTheme } from "@ardinsys/financial-charts";

chart.updateOptions({
  type: "line",
  theme: defaultDarkTheme,
  volume: false
});
```

`type`, `timeRange`, `stepSize`, `maxZoom`, `volume`, theme, and localization
are runtime options. The initial controller set and DOM adapter are constructor
options; additional controller classes can be added later with
`registerController()`.

## Dispose on unmount

Call `dispose()` before the application discards the container. Disposal is
idempotent and removes chart DOM, listeners, observers, plugins, and indicators.

```ts
chart.dispose();
```

## Tree-shake built-in controllers

The root entry imports every built-in controller for convenience. Setting
`includeDefaultControllers: false` changes which controllers are registered at
runtime, but cannot remove those imports from the bundle.

For controller-level tree shaking, import the controller-neutral chart and
only the controllers the application uses:

```ts
import { FinancialChart } from "@ardinsys/financial-charts/core";
import { LineController } from "@ardinsys/financial-charts/controllers/line";

const chart = new FinancialChart(container, {
  controllers: [LineController],
  stepSize: 60_000
});
```

The core chart infers `type` from the first supplied controller when it is
omitted, and it never registers controllers implicitly.

## Next steps

- [Data and updates](/guide/data-and-updates) covers bucketing, partial values,
  clearing, streaming, and late corrections.
- [View and interactions](/guide/view-and-interactions) explains runtime options
  and the three visible-range representations.
- [Styling and localization](/guide/styling-and-localization) covers themes,
  custom formatters, and locale bundles.
- [Drawing tools](/guide/drawing-tools) adds interactive and persisted drawings.
- [State and persistence](/guide/state-and-persistence) restores chart,
  indicator, pane, and contributor state.
- [FinancialChart API](/reference/chart) lists the complete chart contract.
