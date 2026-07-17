---
name: financial-charts
description: >-
  Build financial charts with @ardinsys/financial-charts — construction, data
  loading and streaming, runtime options, tree shaking, indicators, drawings,
  persistence, and the official React/Vue adapters. Use when writing or
  debugging code that imports @ardinsys/financial-charts or its -react/-vue
  adapter packages, or when integrating candlestick/OHLC charts with this
  library.
license: Apache-2.0
---

# Using @ardinsys/financial-charts

Canvas-based charting engine for financial time series. Framework agnostic,
ES modules, no runtime dependencies. Full documentation:
https://docs.ardinsys.eu/financial-charts

## Setup

```ts
import "@ardinsys/financial-charts/style.css"; // once per application
import { FinancialChart, type ChartData } from "@ardinsys/financial-charts";

const chart = new FinancialChart(container, {
  stepSize: 15 * 60 * 1000, // required: bar duration in ms
});
chart.setData(data);
// on unmount:
chart.dispose(); // idempotent; removes DOM, listeners, plugins, indicators
```

- The container must have a measurable width and height before construction;
  the chart follows later size changes via `ResizeObserver`.
- Only `stepSize` is required. Defaults: candlesticks, `timeRange: "auto"`,
  volume on, `maxZoom: 100`, light theme, browser locale.
- Construct only in the browser (client-side): the constructor needs canvas
  contexts and `ResizeObserver`. In SSR apps, create the chart in a mount hook.
- Embedded in a scrolling page? Set `wheelZoom: "modifier"` so plain wheel
  scrolls the page and modifier+wheel zooms the chart.

## Data rules

```ts
type ChartData = {
  readonly time: number; // UNIX ms, finite
  readonly open?: number | null;
  readonly high?: number | null;
  readonly low?: number | null;
  readonly close?: number | null;
  readonly volume?: number | null;
};
```

- `setData(data)` replaces the full dataset: it copies, validates, sorts,
  buckets by `stepSize`, and merges — caller arrays are never mutated. Any
  input order is fine.
- `updateData(point)` is only for the newest observation: it merges into the
  latest bucket or appends a new bar and preserves the current view. Older
  timestamps throw — apply corrections with `setData()` instead.
- Zero is a real value; `null`/missing fields are gaps. Non-finite values
  throw `TypeError`.
- Clear with `clearData()` or `setData([])`.
- The X axis is index based: bars occupy ordinal slots, so weekends, holidays,
  and missing sessions produce no horizontal gaps.

## Runtime options vs construction options

`updateOptions(patch)` applies at runtime: `type`, `timeRange`, `stepSize`,
`maxZoom`, `wheelZoom`, `volume`, theme, and localization. Changing `stepSize`
remaps data and resets zoom/pan. The controller set and DOM adapter are
constructor-only; add controller classes later with `registerController()`.

## Tree shaking

The root entry registers every built-in controller. For smaller bundles,
import the controller-neutral chart and only what you use:

```ts
import { FinancialChart } from "@ardinsys/financial-charts/core";
import { LineController } from "@ardinsys/financial-charts/controllers/line";

const chart = new FinancialChart(container, {
  controllers: [LineController],
  stepSize: 60_000,
});
```

Controllers: `area`, `bar`, `candle`, `hlc-area`, `hollow-candle`, `line`,
`stepline` — each under `@ardinsys/financial-charts/controllers/*`. Custom
indicator/plugin/drawing base classes come from
`@ardinsys/financial-charts/extensions`.

## React and Vue

Use the official adapters instead of hand-rolling lifecycle code:
`@ardinsys/financial-charts-react` (16.8+) and
`@ardinsys/financial-charts-vue` (3+). Both export a `FinancialChart`
component that owns creation/disposal, applies runtime option changes via
`updateOptions()`, and calls `setData()` when the `data` array identity
changes.

- Treat `data` as an immutable snapshot: replace the array, do not mutate or
  deep-watch it.
- Route a live feed directly to the instance
  (`ref.current?.chart?.updateData(point)` / `chartRef.value?.chart?.updateData(point)`),
  not through props/reactivity.
- Changing construction-only options (controllers, registered themes, DOM
  adapter) recreates the chart.

## Extensions and persistence

- Indicators extend `Indicator` (overlay) or `PaneledIndicator` (own pane) and
  are attached to the chart; drawings (trendline, horizontal line, rectangle,
  text) and chart/indicator/drawing state serialize to versioned JSON for
  persistence.
- Values handed to extension callbacks are borrowed readonly snapshots — never
  mutate them; copy when a historical value must be retained.
- Attach plugins before restoring contributor state. Chart state can be
  restored before data; a pre-data visible window applies on the next
  `setData()`.

## Common mistakes

- Calling `updateData()` with a full array or an old timestamp — it accepts
  one newest point only.
- Forgetting the stylesheet import (indicator labels and pane dividers are
  unstyled without it).
- Constructing into a zero-height container.
- Skipping `dispose()` on unmount, leaking observers and listeners.
- Expecting `includeDefaultControllers: false` to shrink the bundle — use the
  `/core` entry and per-controller imports for that.
