# Quick start

Follow these steps to render your first chart with sensible defaults. Timestamps are finite numbers in milliseconds, and every example assumes you can pass a real DOM element to the chart.

## 1. Install

```bash
npm install @ardinsys/financial-charts
```

Import the distributed stylesheet when you need indicator labels or paneled indicators.

```ts
import "@ardinsys/financial-charts/style.css";
```

## 2. Create the chart

The built-in controllers are available by default on each chart instance. The basic flow is constructor, then `setData(data)`.

```ts
import { FinancialChart } from "@ardinsys/financial-charts";

const chart = new FinancialChart(root, "auto", {
  type: "candle",
  stepSize: 15 * 60 * 1000,
  maxZoom: 100,
  volume: true
});

chart.setData(data);
```

## 3. Pick or extend a theme

Merge the shipped light/dark themes with your overrides. Missing fields fall back to the defaults.

```ts
import {
  defaultDarkTheme,
  defaultLightTheme,
  mergeThemes,
  type ChartTheme
} from "@ardinsys/financial-charts";

const customTheme: ChartTheme = {
  grid: { color: "#333333" },
  crosshair: { color: "#FF6B6B" }
};

const theme = mergeThemes(defaultDarkTheme, customTheme);
```

## 4. Apply the theme

Pass a container element, a base time range (or `"auto"`), and chart options.

```ts
const chart = new FinancialChart(
  document.getElementById("chart-root")!,
  "auto",
  {
    type: "candle",
    theme,
    locale: "en",
    maxZoom: 100,
    stepSize: 15 * 60 * 1000,
    volume: true
  }
);
```

Localization is configurable via `updateLocalization`. See [Guide > Styling and localization](/guide/styling-and-localization) for a full example that rebuilds the chart's locale bundle when the active locale changes.

## 5. Push data

Use the exported `ChartData` shape. Fields are optional because not every controller needs every value, but send the complete tuple whenever you have it.

```ts
type ChartData = {
  readonly time: number;
  readonly open?: number | null;
  readonly high?: number | null;
  readonly low?: number | null;
  readonly close?: number | null;
  readonly volume?: number | null;
};
```

- Use `null` for missing values. Optional fields exist so controllers can ignore what they don't use.

Call `setData` with candles in any order. The chart copies and sorts them, snaps timestamps to `stepSize`, and merges duplicates without losing zero or partial values.

```ts
chart.setData([
  {
    time: Date.UTC(2024, 0, 1, 9, 0),
    open: 11,
    high: 15,
    low: 10,
    close: 10,
    volume: 1200000
  },
  {
    time: Date.UTC(2024, 0, 1, 9, 15),
    open: 10,
    high: 15,
    low: 8,
    close: 15,
    volume: 1500000
  }
]);
```

## 6. Stream updates and dispose

Use `updateData` for streaming data: it initializes an empty chart, appends a new candle, or merges into the current `stepSize` bucket. That keeps the live feed smooth without rebuilding the whole dataset.

Streaming timestamps must be monotonic. Use `setData` for an older correction.

```ts
chart.updateData({
  time: Date.UTC(2024, 0, 1, 9, 30),
  open: 11,
  high: 14,
  low: 10,
  close: 13,
  volume: 1600000
});
```

Dispose the chart when tearing down the DOM node so observers and listeners are cleaned up.

```ts
chart.dispose();
```

## Next steps

- [Guide > Data and updates](/guide/data-and-updates) explains how `setData`/`updateData` interact with step size and auto ranges.
- [Guide > View and interactions](/guide/view-and-interactions) covers zooming, panning, and core runtime options.
- [Guide > Drawing tools](/guide/drawing-tools) shows how to add trendlines, rectangles, text, and persistence.
- [Guide > Styling and localization](/guide/styling-and-localization) walks through themes, custom formatters, and locales.
- The [API Reference](/reference/chart) lists every method signature and event payload.
