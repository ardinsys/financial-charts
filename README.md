# Financial charts

**Still in BETA.**

**Documentation is work in progress. This is just a basic outline, what you can do and how can you use the basic features.**

Canvas based charting library for price charts with a dead simple API, which supports themes, custom locales or even a full custom formatter for dates and prices. Still optimized for trading applications, keeping the bundle tiny (16.5 kB gzipped, no third party dependencies) and exposing hooks for controllers, themes, locales and formatters.

## Features

- more than fast enough
- small (16.5 kB gzipped) (no 3rd party dependencies)
- framework agnostic
- touch support
- zooming, panning
- your data will be automatically mapped to the give step size
- extendable with your own controllers (library is built to support financial charts, time based X axis with number based Y, keep this in mind while we are talking about extensibility)
- you can make custom themes, or use the default light/dark theme
- you can change the locale or you can even replace the whole formatter
- indicators (currently there isn't any premade indicator, just a test SMA)
- paneled indicators (WIP)

## Installation

```bash
npm install @ardinsys/financial-charts
```

The package ships as an ES module and works with bundlers such as Vite, Webpack, Rollup, or any environment that can consume modern JavaScript. When using indicators, remember to include the distributed stylesheet.

```ts
import "@ardinsys/financial-charts/dist/style.css";
```

## Usage overview

### 1. Register the controllers you plan to use

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

### 2. Import or extend a theme

```ts
import {
  defaultLightTheme,
  defaultDarkTheme,
  mergeThemes,
  type ChartTheme
} from "@ardinsys/financial-charts";

const customTheme: ChartTheme = {
  grid: {
    color: "#282b38",
    width: 1
  }
};

const theme = mergeThemes(defaultLightTheme, customTheme);
const darkTheme = mergeThemes(defaultDarkTheme, customTheme);
```

### 3. Create a chart instance

```ts
const chart = new FinancialChart(
  document.getElementById("my-container")!,
  {
    start: Date.UTC(2024, 0, 1, 9, 0),
    end: Date.UTC(2024, 0, 1, 17, 0)
  },
  {
    type: "candlestick",
    stepSize: 15 * 60 * 1000,
    maxZoom: 150,
    volume: true,
    theme,
    locale: "EN"
  }
);
```

### 4. Draw data

```ts
chart.draw([
  {
    time: Date.UTC(2024, 0, 1, 9, 0),
    open: 11,
    high: 15,
    low: 10,
    close: 10,
    volume: 1_200_000
  },
  {
    time: Date.UTC(2024, 0, 1, 9, 15),
    open: 10,
    high: 15,
    low: 8,
    close: 15,
    volume: 1_500_000
  }
]);
```

### 5. Stream real-time updates

```ts
chart.drawNextPoint({
  time: Date.UTC(2024, 0, 1, 9, 30),
  open: 11,
  high: 14,
  low: 10,
  close: 13,
  volume: 1_600_000
});
```

## Data requirements

```ts
type Candle = {
  time: number; // UNIX timestamp in milliseconds
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
};
```

- Data **must** be sorted ascending by `time`.
- The library automatically snaps timestamps to the configured `stepSize` and merges duplicates for you.
- Supply the full OHLCV tuple whenever possible so candle bodies, wicks, and volume bars render correctly.
- Call `draw` when you replace the entire dataset, call `drawNextPoint` only for the newest bar.

## Runtime configuration

```ts
// Replace the visible window or adjust the granularity
chart.updateCoreOptions(
  "auto",
  5 * 60 * 1000,
  200 // max zoom factor
);

// Switch controllers (state is preserved)
chart.changeType("hlc-area");

// Toggle the secondary volume histogram
chart.setVolumeDraw(true);

// Merge theme changes at runtime
chart.updateTheme({ crosshair: { color: "#FF6B6B" } });

// Update locale and labels
chart.updateLocale("HU", {
  HU: {
    common: {
      sources: {
        open: "Nyitó",
        high: "Max",
        low: "Min",
        close: "Záró",
        volume: "Forgalom"
      }
    },
    indicators: {
      actions: {
        show: "Megjelenítés",
        hide: "Elrejtés",
        settings: "Beállítás",
        remove: "Törlés"
      }
    }
  }
});
```

`FinancialChart` exposes getters for the current theme, data set, zoom level, and visible time range, which makes it straightforward to drive external UI or persist state.

## Events and interactions

`FinancialChart` extends a small event emitter. Listen for user actions or indicator UI interactions:

```ts
const offClick = chart.on("click", ({ point }) => {
  console.log("Clicked candle", point);
});

chart.on("indicator-settings-open", ({ indicator }) => {
  openSettingsModal(indicator.getOptions());
});

chart.on("indicator-remove", ({ indicator }) => {
  console.log("Removed indicator", indicator.getKey());
});
```

The library exposes `click`, `touch-click`, `indicator-visibility-changed`, `indicator-settings-open`, and `indicator-remove` events out of the box.

## Indicators and extensions

Overlay indicators can be rendered on the main canvas, while paneled indicators get their own mini chart plus axis. Use `chart.addIndicator`/`chart.removeIndicator` to manage them dynamically.

```ts
import { MovingAverageIndicator } from "@ardinsys/financial-charts";

const ma = new MovingAverageIndicator();
chart.addIndicator(ma);

// Later:
chart.removeIndicator(ma);
```

For custom overlays, extend `Indicator` or `PaneledIndicator` and register new controllers that fit your data. Controllers can read zoom level, pan offset, and the mapped `DataExtent` so you have full control over the drawing lifecycle.

## Documentation

The full guide and API reference live in `/docs`. Run `npm run docs:dev` locally or open the published docs site (if available) for in-depth tutorials on configuration, theming, indicators, and the controller API.
