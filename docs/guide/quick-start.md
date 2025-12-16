# Quick start

Follow these steps to render your first chart with sensible defaults. Every example assumes data is ordered by timestamp (milliseconds) and that you can pass a real DOM element to the chart.

## 1. Install

```bash
npm install @ardinsys/financial-charts
```

Import the distributed stylesheet when you need indicator labels or paneled indicators.

```ts
import "@ardinsys/financial-charts/dist/style.css";
```

## 2. Register controllers once

Do this at application startup so the chart knows which renderers it can instantiate.

```ts
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

FinancialChart.registerController(AreaController);
FinancialChart.registerController(LineController);
FinancialChart.registerController(CandlestickController);
FinancialChart.registerController(BarController);
FinancialChart.registerController(HollowCandleController);
FinancialChart.registerController(SteplineController);
FinancialChart.registerController(HLCAreaController);
```

## 3. Pick or extend a theme

Merge the shipped light/dark themes with your overrides. Missing fields fall back to the defaults.

```ts
import {
  defaultDarkTheme,
  defaultLightTheme,
  mergeThemes,
  type ChartTheme,
} from "@ardinsys/financial-charts";

const customTheme: ChartTheme = {
  grid: { color: "#333333" },
  crosshair: { color: "#FF6B6B" },
};

const theme = mergeThemes(defaultDarkTheme, customTheme);
```

## 4. Create the chart

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
    volume: true,
  }
);
```

Localization is configurable via `updateLocale`. See [Guide > Styling and localization](/guide/styling-and-localization) for a full example that rebuilds the chart's locale bundle when the active locale changes.

## 5. Push data

Use the exported `ChartData` shape. Fields are optional because not every controller needs every value, but send the complete tuple whenever you have it.

```ts
type ChartData = {
  time: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};
```

- Use `null` for missing values. Optional fields exist so controllers can ignore what they don't use.

Call `draw` with sorted candles. The chart snaps timestamps to `stepSize` and merges duplicates.

```ts
chart.draw([
  {
    time: Date.UTC(2024, 0, 1, 9, 0),
    open: 11,
    high: 15,
    low: 10,
    close: 10,
    volume: 1200000,
  },
  {
    time: Date.UTC(2024, 0, 1, 9, 15),
    open: 10,
    high: 15,
    low: 8,
    close: 15,
    volume: 1500000,
  },
]);
```

## 6. Stream updates and dispose

Use `drawNextPoint` for streaming data: it appends a new candle by default, and only merges into the latest one when the timestamp lands in the same `stepSize` bucket. That keeps the live feed smooth without rebuilding the whole dataset.

```ts
chart.drawNextPoint({
  time: Date.UTC(2024, 0, 1, 9, 30),
  open: 11,
  high: 14,
  low: 10,
  close: 13,
  volume: 1600000,
});
```

Dispose the chart when tearing down the DOM node so observers and listeners are cleaned up.

```ts
chart.dispose();
```

## Next steps

- [Guide > Data and updates](/guide/data-and-updates) explains how `draw`/`drawNextPoint` interact with step size and auto ranges.
- [Guide > View and interactions](/guide/view-and-interactions) covers zooming, panning, and core runtime options.
- [Guide > Styling and localization](/guide/styling-and-localization) walks through themes, custom formatters, and locales.
- The [API Reference](/reference/chart) lists every method signature and event payload.
