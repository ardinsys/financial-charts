# Financial charts

**Still in BETA.**

Canvas based charting library for price charts with a dead simple API, which supports themes, custom locales or even a full custom formatter for dates and prices.

## Features

- more than fast enough
- small (9.4 kB gzipped) (no 3rd party dependencies)
- framework agnostic
- touch support
- zooming, panning
- your data will be automatically mapped to the give step size
- extendable with your own controllers (library is built to support financial charts, time based X axis with number based Y, keep this in mind while we are talking about extensibility)
- you can make custom themes, or use the default light/dark theme
- you can change the locale or you can even replace the whole formatter

## Planned features

- detailed documentation
- non interactive indicators (only API, UI needs to be made separately)
- interactive drawing (only API, UI needs to be made separately)
- support for use case when you do not want to display a fixed timerange, rather some infite time like trading view does. (will also support realtime moving when new data arrives)
- sync between multiple charts if applicable

## Quick start

### Import and register the controllers you will use

```ts
import { FinancialChart } from "@ardinsys/financial-charts";
import { AreaController } from "@ardinsys/financial-charts";
import { LineController } from "@ardinsys/financial-charts";
import { BarController } from "@ardinsys/financial-charts";
import { HollowCandleController } from "@ardinsys/financial-charts";
import { CandlestickController } from "@ardinsys/financial-charts";
import { SteplineController } from "@ardinsys/financial-charts";
import { HLCAreaController } from "@ardinsys/financial-charts";

FinancialChart.registerController(AreaController);
FinancialChart.registerController(LineController);
FinancialChart.registerController(CandlestickController);
FinancialChart.registerController(BarController);
FinancialChart.registerController(HollowCandleController);
FinancialChart.registerController(SteplineController);
FinancialChart.registerController(HLCAreaController);
```

### Import the default themes, or create your own

```ts
import {
  defaultDarkTheme,
  defaultLightTheme,
  mergeThemes,
  type ChartTheme,
} from "@ardinsys/financial-charts";

const myTheme: ChartTheme = {
  /* provide the values you want to override */
};

// Use the utility function to merge your theme.
// If you only want to use the light theme then you can skip this step
// since by default your theme will be merged with the light theme
const fullTheme = mergeThemes(defaultDarkTheme, myTheme);
```

### Create your chart

```ts
import { FinancialChart } from "@ardinsys/financial-charts";

const chart = new FinancialChart(
  // this can be a react/vue ref or anything. It should be a HTMLElement.
  document.getElementById("my-container"),
  {
    // Time range that will be visible
    // can be "auto" instead of an object (more on that later in the documentation)
    start: nineam.getTime(),
    end: fivepm.getTime(),
  },
  {
    type: "hlc-area",
    theme: myTheme,
    // default is the navigator language
    locale: "EN",
    maxZoom: 100,
    // step size in millis
    stepSize: 15 * 60 * 1000,
    // Should it draw the volume chart as well?
    volume: true,
  }
);
```

### Draw / Update your chart

**Your data must be sorted beforehand!**

```ts
// Initial draw
// If you want to use completely new and different data, also use this method
chart.draw([
  {
    time: nineam.getTime(),
    open: 11,
    high: 15,
    low: 10,
    close: 10,
    volume: 1_200_000,
  },
  {
    time: nineam.getTime() + 1000 * 60 * 15,
    open: 10,
    high: 15,
    low: 8,
    close: 15,
    volume: 1_500_000,
  },
  {
    time: nineam.getTime() + 1000 * 60 * 30,
    open: 15,
    high: 17,
    low: 11,
    close: 12,
    volume: 1_400_000,
  },
]);

// Update with next point
chart.drawNextPoint({
  time: nineam.getTime() + 1000 * 60 * 45,
  close: 13,
  high: 14,
  low: 10,
  open: 11,
  volume: 1_600_000,
});
```

### Change chart type, options, theme, locale etc.

```ts
// Chart will hold its state
chart.changeType("candle");
```

```ts
// Chart will hold its state
chart.updateTheme(yourTheme);
```

```ts
// Chart will hold its state
// Enable or disable volume drawing
chart.setVolumeDraw(true);
```

```ts
// Chart will NOT hold its state
// It will be redrawn with default state
// zoom will be set to 1, panOffset will be set to 0
// data will be remapped to the new stepSize
chart.updateCoreOptions(timeRange, stepSize, maxZoom);
```
