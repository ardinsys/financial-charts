# Getting Started

This guide walks through the minimum steps for integrating `@ardinsys/financial-charts`, explains the required data format, and highlights the runtime hooks you are most likely to reach for on day one.

## Requirements

- A DOM element with a predictable height. The chart listens to a `ResizeObserver`, so simply sizing the container with CSS is enough.
- Data timestamps expressed in **milliseconds** and sorted in ascending order.
- A bundler or build pipeline that can consume ES modules.

## Install

```bash
npm install @ardinsys/financial-charts
```

Import the stylesheet if you plan to show indicator labels or paneled indicators.

```ts
import "@ardinsys/financial-charts/dist/style.css";
```

## Register controllers

The chart needs to know which controllers it may use. Register the controllers you plan to render once during application startup (for example when bootstrapping your SPA).

```ts
import {
  FinancialChart,
  AreaController,
  LineController,
  BarController,
  HollowCandleController,
  CandlestickController,
  SteplineController,
  HLCAreaController
} from "@ardinsys/financial-charts";

FinancialChart.registerController(AreaController);
FinancialChart.registerController(LineController);
FinancialChart.registerController(CandlestickController);
FinancialChart.registerController(BarController);
FinancialChart.registerController(HollowCandleController);
FinancialChart.registerController(SteplineController);
FinancialChart.registerController(HLCAreaController);
```

## Set up a theme

Import the default themes or merge your own overrides. Only override the sections you care about; `mergeThemes` fills in the rest from the defaults.

```ts
import {
  defaultDarkTheme,
  defaultLightTheme,
  mergeThemes,
  type ChartTheme
} from "@ardinsys/financial-charts";

const customTheme: ChartTheme = {
  grid: {
    color: "#333333"
  },
  crosshair: {
    color: "#FF6B6B"
  }
};

const theme = mergeThemes(defaultDarkTheme, customTheme);
```

## Create a chart instance

Pass an element reference, the initial visible timerange, and the chart configuration. The chart starts drawing immediately once it receives data.

```ts
const chart = new FinancialChart(
  document.getElementById("chart-root")!,
  {
    start: Date.UTC(2024, 0, 1),
    end: Date.UTC(2024, 0, 5)
  },
  {
    type: "candlestick",
    theme,
    locale: "EN",
    maxZoom: 100,
    stepSize: 15 * 60 * 1000,
    volume: true
  }
);
```

When you want the chart to calculate the window automatically, pass `"auto"` as the second argument instead of `{ start, end }`.

## Provide data

```ts
type Candle = {
  time: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};
```

Call `draw` with **sorted** candles. The chart snaps timestamps to the configured `stepSize` and merges duplicates for you.

```ts
chart.draw([
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

## Stream updates and dispose

Use `drawNextPoint` for live feeds where only the latest candle changes.

```ts
chart.drawNextPoint({
  time: Date.UTC(2024, 0, 1, 9, 30),
  open: 11,
  high: 14,
  low: 10,
  close: 13,
  volume: 1600000
});
```

When unmounting (for example inside a framework component `onUnmounted`/`useEffect` cleanup) call `chart.dispose()` so event listeners and observers are released.

## Framework usage tips

- React/Vue/Svelte can pass refs directly. The chart only needs a real `HTMLElement`.
- Because `FinancialChart` manages its own canvases, you typically instantiate it in an effect hook and keep a ref to the instance for future updates.
- Resize the parent container through CSS grid/flexbox – the library will detect the new bounds automatically via `ResizeObserver`.

## Next steps

- Head to the Configuration guide for details on zooming, panning, indicators, and lifecycle hooks.
- Read the API reference for every method signature plus the event emitter contract.
