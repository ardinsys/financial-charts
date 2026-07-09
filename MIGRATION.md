# Migrating to v1.0

v1.0 is an architecture release. It keeps the main chart construction flow
recognizable, but several low-level assumptions changed so charts can use
ordinal financial bars, panes, plugins, and drawing tools.

## Breaking changes

### X coordinates are index-based

Bars are now projected by ordinal index instead of continuous elapsed time.
Missing calendar periods such as weekends, holidays, or sparse intraday gaps no
longer reserve blank horizontal space. This changes pixel positions compared to
v0.9 for data with missing timestamps.

What to update:

- Continue passing millisecond timestamps in `ChartData.time`.
- Do not assume pixel distance equals elapsed wall-clock time.
- Use `chart.getTimeScale().project(time, { canvas })` for a timestamp or
  `projectIndex(index, { canvas })` when you already have an ordinal anchor.
- Use `{ index, price }` for drawing anchors, not `{ time, price }`.

### Visible range and pan/zoom are range-model driven

The chart internally tracks a fractional visible index range. Public helpers such
as `getVisibleTimeRange()` still return timestamps, but `getZoomLevel()` is now
derived from the visible index span and `getPanOffset()` is retained only as a
compatibility value.

What to update:

- Prefer `getVisibleTimeRange()` for UI state.
- Use `updateCoreOptions(range, stepSize, maxZoom)` when changing symbol,
  timeframe, or base range.
- Avoid persisting old zoom/pan scalar values from v0.9; persist the data range
  or application-level view state instead.

### Render invalidation uses named layers

`requestRedraw()` now targets render layers:

```ts
chart.requestRedraw(["grid", "axes", "series", "indicators", "drawings"]);
```

The compatibility alias `"controller"` invalidates `grid`, `axes`, and `series`.
The full layer set is `"grid"`, `"axes"`, `"series"`, `"indicators"`,
`"drawings"`, and `"crosshair"`.

### Plugins own lifecycle hooks

Custom overlays should be implemented as `ChartPlugin` instances and attached
with `chart.addPlugin(plugin)`.

```ts
const plugin = {
  key: "example",
  attach(ctx) {
    this.ctx = ctx;
  },
  draw() {
    // render custom overlay
  },
  detach() {
    // release external resources
  }
};

chart.addPlugin(plugin);
```

Plugins receive `attach`, `onData`, `onVisibleRangeChanged`,
`beforeDraw`/`draw`/`afterDraw`, `onPointer`, and `detach` hooks. `removePlugin`
and `dispose()` call `detach()`.

### Indicators use the plugin lifecycle

Indicators now implement the same plugin lifecycle internally. Indicator label
HTML can be provided through `labelTemplate` or a custom `labelRenderer`, and
label event listeners are detached when indicators are removed.

What to update:

- Keep using `chart.addIndicator(indicator)` and
  `chart.removeIndicator(indicator)` for built-ins.
- For custom indicators, implement `draw()`, `updateLabel()`,
  `getDefaultOptions()`, and `getDefaultThemes()` as before, but use the chart's
  scale/pane helpers instead of importing removed extent classes.
- Use `getModifier(visibleTimeRange)` to contribute to price auto-ranging.

### Paneled indicators are pane-backed

Paneled indicators are laid out through `Pane` models that share the chart's
`TimeScale` and own their `PriceScale` and Y-axis region. Crosshair and pointer
events are routed by pane hit testing.

What to update:

- Use the `pane` passed in `InitParams` when you need pane geometry or scales.
- Keep panel drawing inside `draw()` and call `initDrawing()` before rendering
  custom panel content.

### Formatter options are explicit and SSR-safe

`DefaultFormatter` no longer reads browser globals at module initialization.
Locale and timezone are resolved when an instance is created, and formatter
options can be passed in one place:

```ts
const formatter = new DefaultFormatter({
  locale: "en-US",
  timeZone: "UTC",
  dateTimeFormatOptions: {
    tooltipDate: { dateStyle: "medium", timeStyle: "short" }
  },
  numberFormatOptions: {
    price: { maximumFractionDigits: 2 }
  }
});
```

`Formatter` also supports seconds/sub-minute labels and `setTimeZone()` /
`getTimeZone()` for runtime changes.

### Drawings are first-class plugins

Drawing tools live under `src/drawings` and are managed by `DrawingManager`.
Built-in tools include `TrendLine`, `HorizontalLine`, `RectangleDrawing`, and
`TextDrawing`.

Drawings persist through `manager.toJSON()` and `manager.fromJSON(snapshot)`.
Storage itself is application-owned.

### Events are generic and extensible

The event emitter remains compatible with existing `chart.on(...)` calls, while
the built-in event map now includes indicator and drawing events. Plugin authors
can use the generic event emitter types for custom event maps.

### Pluggable UI adapter for chrome (indicator labels)

DOM chrome now goes through a `ChartUIAdapter`. The default `WebUIAdapter`
reproduces the built-in behavior, so no change is required for existing users —
core stays dependency-free. The indicator label contract is unchanged:
indicators still author `labelTemplate` HTML and update `this.labelContainer`
via `data-id` hooks. What moved is only the generic host/button wiring
(previously hardcoded in `Indicator`), now owned by the adapter.

- New option: `new FinancialChart(el, range, { ..., uiAdapter })`. Omit it to get
  the default `WebUIAdapter`.
- Plugins receive the adapter via `ChartContext.ui`.
- This is the seam the forthcoming `@ardinsys/financial-charts-vue` /
  `-react` packages implement to render chrome with framework components.

## Removed or replaced internals

- Continuous `Extent` mapping was replaced by scales and `DataScaleModel`.
- Duplicate price tick math was replaced by `PriceTickGenerator` helpers.
- Per-bar X-label generation was replaced by `TimeTickGenerator`.
- The chart's old array scans were replaced with `DataStore` lookup helpers.

### Public API renamed (`extent` → `scale`)

The internal `Extent`/`DataExtent` rename to `Scale`/`DataScaleModel` is now
carried through the public surface. These names changed (no compatibility
aliases):

| Old (0.9)                             | New (1.0)                              |
| ------------------------------------- | -------------------------------------- |
| `chart.getVisibleExtent()`            | `chart.getVisibleScale()`              |
| `chart.recalculateVisibleExtent()`    | `chart.recalculateVisibleScale()`      |
| `PaneledIndicator.createExtent()`     | `PaneledIndicator.createScale()`       |
| `PaneledIndicator` protected `extent` | protected `scale`                      |
| `PaneYAxisRenderOptions.extent`       | `PaneYAxisRenderOptions.scale`         |

### Zoom/pan vocabulary removed in favor of the index range

The old continuous-time zoom/pan scalars no longer model the index-based scale
(`panOffset` was always `0`; `zoomLevel` was a derived ratio). They are removed:

- `chart.getZoomLevel()` / `chart.getPanOffset()` → **removed**. Use
  `chart.getVisibleLogicalRange()`, which returns the visible bar index range
  `{ from, to, rightOffset }`.
- `ScaleProjectOptions.zoomLevel` / `.panOffset` → **removed**. `project()` /
  `unproject()` derive position from the scale's own range; pass only
  `{ canvas, barAlignment? }`.
- `DataScaleModel.mapToPixel` / `pixelToPoint` / `mapVolToPixel` no longer accept
  `zoomLevel` / `panOffset` arguments.
- `chart.getPixelPerMs()` → **removed**. Under the index model bar width is a
  count of pixels per bar, not per millisecond. Use `chart.getPixelsPerBar()`
  directly (callers no longer multiply by `stepSize`).

## Suggested upgrade path

1. Update imports and register controllers once at app startup.
2. Confirm charts with missing calendar periods render as desired; blank weekend
   gaps are intentionally gone.
3. Replace custom overlay code with `ChartPlugin` where possible.
4. Update custom indicators to the plugin/pane lifecycle.
5. Replace old formatter subclasses with `DefaultFormatter` options or the new
   optional formatter methods.
6. Add `DrawingManager` only where users need interactive drawings, and persist
   its JSON snapshot in application state.
