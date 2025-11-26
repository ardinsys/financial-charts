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

## 4. Create the chart

Pass a container element, a base time range (or `"auto"`), and chart options.

```ts
const chart = new FinancialChart(
  document.getElementById("chart-root")!,
  "auto",
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

### Optional: wire in your i18n bundle

If you already use `@ardinsys/intl`, pass the same locale code and strings to the chart so indicator labels match the rest of the UI.

```ts
import { createIntl } from "@ardinsys/intl";

const { locale, setLocale, t } = createIntl("en", {
  en: { messages: { indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } } } },
  hu: { messages: { indicators: { actions: { show: "Megjelenítés", hide: "Elrejtés", settings: "Beállítás", remove: "Törlés" } } } }
});

chart.updateLocale(locale, {
  [locale]: {
    indicators: { actions: {
      show: t("indicators.actions.show"),
      hide: t("indicators.actions.hide"),
      settings: t("indicators.actions.settings"),
      remove: t("indicators.actions.remove")
    }},
    common: { sources: {
      open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume"
    }}
  }
});
```

Call `setLocale("hu")` (or any supported code) and rerun `updateLocale` with the matching translation block to refresh labels and tooltips.

## 5. Push data

Use the `Candle` shape – values are optional so you can stream partial updates.

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

Call `draw` with sorted candles. The chart snaps timestamps to `stepSize` and merges duplicates.

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

## 6. Stream updates and dispose

`drawNextPoint` lets you update the latest candle in real time without rebuilding the dataset.

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

Dispose the chart when tearing down the DOM node so observers and listeners are cleaned up.

```ts
chart.dispose();
```

## Next steps

- `Guide > Data and updates` explains how `draw`/`drawNextPoint` interact with step size and auto ranges.
- `Guide > View and interactions` covers zooming, panning, and core runtime options.
- `Guide > Styling and localization` walks through themes, custom formatters, and locales.
- The API Reference lists every method signature and event payload.
