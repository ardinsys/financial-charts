# Data and updates

Charts stay predictable when the incoming feed matches the expected shape and cadence. This guide shows how the library maps raw data to the active `stepSize` and how to update the view without rebuilding everything.

## Candle shape and ordering

```ts
type ChartData = {
  readonly time: number; // UNIX timestamp in milliseconds
  readonly open?: number | null;
  readonly high?: number | null;
  readonly low?: number | null;
  readonly close?: number | null;
  readonly volume?: number | null;
};
```

- Every present value must be a finite number. Zero is a valid price or volume.
- `setData` accepts any input order and sorts a copied dataset by `time`.
- Timestamps are snapped to the configured `stepSize` so minor drift does not break alignment.
- Bars render in ordinal index slots, so missing market sessions do not create horizontal time gaps.
- Missing values (`null`/`undefined`) are allowed. Controllers treat incomplete
  points as gaps when their required fields are unavailable.

## Initial load with `setData`

Use `setData(data)` to replace the full dataset. Provide either a concrete range or `"auto"` when constructing the chart:

- **Explicit range:** the view starts at `{ start, end }`, then maps the matching bars into an index-based visible window.
- **Auto:** the configured range starts at the first candle and ends after the
  last candle or after enough empty slots to fill the viewport, whichever is
  later.

When the range is `"auto"`, subsequent `setData()` calls recompute the
configured and visible ranges. Pass `[]` or call `clearData()` to synchronously
clear mapped data, scales, crosshair state, indicator values, and rendered chart
layers. An auto range resets to `{ start: 0, end: 0 }`; an explicit configured
range remains available for the next dataset.

`setData` copies its input and never reorders or changes caller-owned arrays or
points. After sorting, points in the same snapped bucket are merged in timestamp
order. Sorting is stable, so exact duplicate timestamps retain their input
order.

Bucket fields follow these rules:

- `open`: first non-missing value.
- `high`: greatest non-missing value.
- `low`: smallest non-missing value.
- `close`: last non-missing value.
- `volume`: sum of non-missing values.

`null` and `undefined` do not erase an existing numeric value. If a field has no
numeric value, an explicitly supplied `null` is retained; a field that was only
omitted stays omitted. This makes close-only data, partial OHLC updates, missing
volume, and zero values safe to combine.

Validation happens before the replacement becomes active. A non-finite
timestamp or present OHLCV value throws `TypeError`; an invalid `stepSize`
throws `RangeError` during construction or `updateOptions()`.

## Streaming with `updateData`

`updateData(point)` initializes an empty chart or appends/merges one candle:

- If the timestamp falls after the last candle's slot, a new candle is appended.
- If the incoming timestamp falls into the same slot as the last candle (based
  on `stepSize`), the data is merged.
- The raw timestamp must be equal to or greater than the latest raw timestamp
  supplied to the chart. A point cannot move backward within the latest bucket.
- The current zoom and pan are preserved where possible so live feeds do not jump unexpectedly.
- If the viewport is anchored at the right edge, the newest candle scrolls into view automatically.

## Switching timeframes

To change granularity or the configured data range, call `chart.updateOptions()`.
The chart remaps its data when `stepSize` changes, so expect zoom and pan to
reset.

```ts
chart.updateOptions({
  timeRange: { start: Date.UTC(2024, 0, 2), end: Date.UTC(2024, 0, 6) },
  stepSize: 30 * 60 * 1000,
  maxZoom: 120
});
```

Use `chart.getOptions()` to read the resolved configuration and
`chart.getVisibleTimeRange()` to read the current whole-bar view before applying
updates.

`getVisibleTimeRange()` returns timestamps for the currently visible bar window.
Internally, panning and zooming use a fractional index range so sparse calendars
remain visually compact.

The three public view representations have distinct precision:

- `getVisibleLogicalRange()` / `setVisibleLogicalRange()` use exact fractional
  bar indexes.
- `getVisibleTimeWindow()` / `setVisibleTimeWindow()` preserve that fractional
  position through interpolated timestamps, making them suitable for chart
  synchronization.
- `getVisibleTimeRange()` / `setVisibleTimeRange()` use whole bars and an
  end-exclusive timestamp range.

Every setter clamps to the chart's current index bounds with a minimum one-bar
span, recalculates the visible price scale, notifies extensions once, and
redraws all view-dependent layers. Reapplying the effective range does not
notify or redraw. All three setters are no-ops while the chart has no data.

## Reading mapped data

`chart.getData()` returns a stable borrowed readonly snapshot of the dataset
**after** it has been mapped to the active `stepSize`. Repeated reads return the
same array until mapped data changes. Stored points are owned by the chart and
are not references to mutable caller-owned objects. Use the snapshot to hydrate
UI lists, run calculations, or persist mapped data without reprocessing the raw
feed. Copy it only when you need a mutable working set or an independent
historical value.

## Handling late or out-of-order data

`updateData()` only accepts monotonic raw timestamps. Equal timestamps are
valid duplicates; an older timestamp throws `RangeError` without changing chart
data. Apply late corrections with `setData()`, which sorts and rebuilds the full
series.

- New points that land in the same `stepSize` bucket as the last candle use the same field merge rules as `setData`.
- Timestamps are snapped **down** to the nearest `stepSize` boundary. If that is not desired, align them before calling `updateData`.
- Non-finite timestamps or present values throw `TypeError` rather than entering
  chart state. Zero is finite and remains valid.

## Troubleshooting gaps and jumps

- **Expected calendar gaps disappeared:** v1 uses index-based X mapping by design. Missing weekends, holidays, and sparse bars collapse into neighboring ordinal slots.
- **Gaps after switching step size:** the chart remaps data on `updateOptions`, so zoom/pan reset is expected when `stepSize` changes.
- **Live chart stops scrolling:** when auto range is on, the view only follows the right edge if you haven't panned away. Call `setVisibleTimeRange(chart.getTimeRange())` to restore the full configured range.
- **Mixed timezones:** pass UTC timestamps (number) rather than `Date` instances to keep snapping consistent across locales.
