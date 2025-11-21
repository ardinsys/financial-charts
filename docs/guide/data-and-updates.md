# Data and updates

Charts stay predictable when the incoming feed matches the expected shape and cadence. This guide shows how the library maps raw data to the active `stepSize` and how to update the view without rebuilding everything.

## Candle shape and ordering

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

- Sort candles in ascending order by `time`.
- Timestamps are snapped to the configured `stepSize` so minor drift does not break alignment.
- Missing values (`null`/`undefined`) are allowed – the library draws gaps rather than crashing.

## Initial load with `draw`

Use `draw(data)` to replace the full dataset. Provide either a concrete range or `"auto"` when constructing the chart:

- **Explicit range:** the view starts at `{ start, end }` and zooms relative to that base window.
- **Auto:** the chart derives the window from the first and last candle plus one extra `stepSize`.

When the range is `"auto"`, subsequent `draw` calls recompute the visible span automatically.

## Streaming with `drawNextPoint`

`drawNextPoint(point)` updates only the newest candle:

- If the incoming timestamp falls into the same slot as the last candle (based on `stepSize`), the data is merged.
- The current zoom and pan are preserved where possible so live feeds do not jump unexpectedly.
- If the viewport is anchored at the right edge, the newest candle scrolls into view automatically.

## Switching timeframes

To change granularity or visible window, call `chart.updateCoreOptions(range, stepSize, maxZoom)`. Entire state is recalculated because the mapped data depends on `stepSize`, so expect zoom and pan to reset when the step changes.

```ts
chart.updateCoreOptions(
  { start: Date.UTC(2024, 0, 2), end: Date.UTC(2024, 0, 6) },
  30 * 60 * 1000,
  120
);
```

You can always read the current values with `chart.getOptions()` and `chart.getVisibleTimeRange()` before applying updates.

## Reading mapped data

`chart.getData()` returns the dataset **after** it has been mapped to the active `stepSize`. Use it to hydrate UI lists, run calculations, or persist state without reprocessing your raw feed.
