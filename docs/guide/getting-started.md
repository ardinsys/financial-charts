# Getting Started

This guide walks you through the minimum steps for adding `@ardinsys/financial-charts` to a web project and rendering your first chart.

## Install

```bash
npm install @ardinsys/financial-charts
```

The library ships as an ES module and can be used with bundlers such as Vite, Webpack, or plain browser build tooling.

## Register controllers

The chart needs to know which controllers it may use. Register the controllers you plan to render once during application startup.

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

Import the default themes or merge your own overrides. When working with indicators, include the bundled stylesheet.

```ts
import {
  defaultDarkTheme,
  defaultLightTheme,
  mergeThemes,
  type ChartTheme
} from "@ardinsys/financial-charts";
import "@ardinsys/financial-charts/dist/style.css";

const customTheme: ChartTheme = {
  grid: {
    color: "#333333"
  }
};

const theme = mergeThemes(defaultDarkTheme, customTheme);
```

## Create a chart instance

Pass an element reference, the initial visible timerange, and the series configuration. The chart instantly draws using the supplied options.

```ts
const chart = new FinancialChart(
  document.getElementById("chart-root"),
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

## Draw data

Provide sorted OHLCV data to render the chart. Use `draw` for an initial render or full refresh, and `drawNextPoint` to stream updates.

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

chart.drawNextPoint({
  time: Date.UTC(2024, 0, 1, 9, 30),
  open: 11,
  high: 14,
  low: 10,
  close: 13,
  volume: 1600000
});
```

## Next steps

- Head to the Configuration guide for details on resizing, zooming, and programmatic updates.
- Read the API reference for method signatures and options.
