# Migrating to v1.0

v1.0 is an architecture release. It keeps the main chart construction flow
recognizable, but several low-level assumptions changed so charts can use
ordinal financial bars, panes, plugins, and drawing tools.

## Breaking changes

### Styles use the public package subpath

Import the optional chart stylesheet through the package export rather than its
internal `dist` directory:

```ts
import "@ardinsys/financial-charts/style.css";
```

Replace any previous
`@ardinsys/financial-charts/dist/style.css` import. Package-internal output paths
are not part of the public API.

### Data replacement and streaming have explicit names

Use `setData(data)` for full replacement, `setData([])` or `clearData()` for
clearing, and `updateData(point)` for one streaming update. Streaming can now
initialize an empty chart safely.

`draw(data)` and `drawNextPoint(point)` remain as deprecated migration aliases;
they delegate directly to `setData` and `updateData`.

`setData` now copies and sorts full datasets before merging `stepSize` buckets.
Bucket merges preserve zero and tolerate partial values: open uses the first
available value, high/low use their extrema, close uses the last available
value, and volume sums available values. `updateData` accepts equal or newer
timestamps and throws for older corrections; use `setData` for those.

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
as `getVisibleTimeRange()` still return timestamps, and
`getVisibleLogicalRange()` exposes the underlying bar-index window when you need
to persist or inspect index-space view state.

What to update:

- Prefer `getVisibleTimeRange()` for UI state.
- Use `getVisibleTimeWindow()` when synchronization must preserve fractional
  pan/zoom positions; use `getVisibleLogicalRange()` for index-space state.
- Public logical, whole-bar time, and precise time-window setters now all
  clamp, rescale, notify extensions once, and redraw without a follow-up call.
  They are no-ops before data is loaded.
- Use `updateCoreOptions(range, stepSize, maxZoom)` when changing symbol,
  timeframe, or base range.
- Avoid persisting old zoom/pan scalar values from v0.9; persist the data range,
  `getVisibleTimeRange()`, or `getVisibleLogicalRange()` depending on your UI.

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

Indicators now implement the same plugin lifecycle internally. Indicator labels
are data models rendered by the active `ChartDOMAdapter`; label event listeners
are detached when indicators are removed.

What to update:

- Keep using `chart.addIndicator(indicator)` and
  `chart.removeIndicator(indicator)` for built-ins.
- For custom overlay indicators, implement `draw()`, `getLabelContent()`,
  `getDefaultOptions()`, and `getDefaultThemes()`. Use
  `getDrawingContext()` for canvas, data, formatter, theme, and projection
  helpers.
- For custom paneled indicators, implement `createScale()`, `drawPane()`,
  `getLabelContent()`, and `getCrosshairValue()` so the base class can own pane
  layout, canvas sizing, background, grid, and Y-axis drawing.
- Do not call `indicator.setChart(chart)` directly; that public hook was removed.
  The inherited `attach(ctx)` lifecycle now stores the chart context and creates
  labels.
- Downstream indicator packages, including `commons-js` indicators, should move
  old `updateLabel()` DOM writes into `getLabelContent()` and return
  `{ detail, segments }`.
- Use `getModifier(visibleTimeRange)` to contribute to price auto-ranging.

### Paneled indicators are pane-backed

Paneled indicators are laid out through `Pane` models that share the chart's
`TimeScale` and own their `PriceScale` and Y-axis region. Crosshair and pointer
events are routed by pane hit testing.

What to update:

- Use the `pane` passed in `InitParams` when you need pane geometry or scales.
- Prefer `drawPane(context)` for panel content. Existing indicators that
  override `draw()` still work, but new indicators should let the base class
  handle the pane boilerplate.

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
`ChartOptions.timeZone` forwards the IANA timezone to compatible formatters, and
`chart.updateLocalization({ locale, timeZone, formatter, localeValues })`
updates the full localization bundle in one redraw.

### Drawings are first-class plugins

Drawing tools live under `src/drawings` and are managed by `DrawingManager`.
Built-in tools include `TrendLine`, `HorizontalLine`, `RectangleDrawing`, and
`TextDrawing`.

Drawings persist through `manager.toJSON()` and `manager.fromJSON(snapshot)`.
Storage itself is application-owned.
Register custom drawing deserializers on each `DrawingManager` instance; drawing
deserializers are not global.

### Controller registration is instance-scoped

The global mutable controller registry was removed.
`FinancialChart.registerController` no longer exists.

What to update:

- Omit `controllers` to use only the built-in chart types on that instance.
- Pass controller classes in chart options to add them to the built-ins.
- Set `includeDefaultControllers: false` when you want an exact custom set. In
  that mode, the `controllers` array must include the class for the initial
  `type`.
- For late-loaded controller extensions, call `chart.registerController(...)` on
  the target chart instance. Call `chart.registerDefaults()` to add the built-ins
  to an instance that was constructed with a custom set.
- To exclude unused built-in controllers from application bundles, import
  `FinancialChart` from `@ardinsys/financial-charts/core` and each required
  controller from its `@ardinsys/financial-charts/controllers/*` entry point.
  The root entry remains the convenient all-controller setup.
- Collection getters now return frozen readonly snapshots. Plugin keys and
  plugin/indicator instances cannot be registered twice on one chart.
  `addPlugin()` and `addIndicator()` return idempotent disposers, while their
  remove counterparts return whether an attached extension was removed.

```ts
const chart = new FinancialChart(root, "auto", {
  type: "candle",
  stepSize: 15 * 60 * 1000,
  maxZoom: 100,
  volume: true
});

chart.registerController(CustomController);
```

`FinancialChart.registerIndicator` and `FinancialChart.createIndicator` were
removed rather than replaced. Instantiate indicators directly and add them to the
chart:

```ts
const indicator = new MovingAverageIndicator(null, { period: 20 });
chart.addIndicator(indicator);
```

### Events are generic and extensible

The event emitter remains compatible with existing `chart.on(...)` calls, while
the built-in event map now includes indicator and drawing events. Plugin authors
can use the generic event emitter types for custom event maps.

### Pluggable DOM adapter (indicator labels and pane dividers)

DOM UI now goes through a `ChartDOMAdapter`. The default `DefaultDOMAdapter`
reproduces the built-in look, so no change is required for existing users — core
stays dependency-free. It exposes stable `fci-*` class hooks for CSS restyling
and can be replaced when indicator labels/actions or pane dividers should use
app-owned DOM.

**Indicator labels are now a data model, not HTML (BREAKING for indicator
authors).** The old `labelTemplate` / `labelRenderer` / `data-id` / imperative
`updateLabel()` DOM mutation is removed. Instead an indicator implements:

```ts
protected getLabelContent(dataTime?: number): IndicatorLabelContent {
  // { name?, detail?, segments?: { text, color? }[] }
  return { detail: "10 close", segments: [{ text: "12.34", color: "#2962FF" }] };
}
```

The base `Indicator` builds an `IndicatorLabelModel` (name from localized
`names`, actions, visibility) and hands it to the adapter. Multi-color values
(Bollinger, MACD) are expressed as multiple
`segments`. This is what lets DOM adapters render labels using app-owned
markup, styling, or framework components.

- New option: `new FinancialChart(el, range, { ..., domAdapter })`. Omit it to
  get the default `DefaultDOMAdapter`.
- Plugins receive the adapter via `ChartContext.domAdapter`.
- The adapter also builds the composition layer via
  `createOverlay(host, context)` (overlay label region + DOM
  toolbars/legend/settings).
- Pane dividers are rendered by `createPaneDivider(model, actions)`. Custom
  adapters can override it; if omitted, the chart falls back to
  `DefaultDOMAdapter`.
- **Migration for indicator authors:** replace `updateLabel()` DOM writes and any
  `labelTemplate`/`labelRenderer` options with a `getLabelContent()` returning
  `{ detail, segments }`.

## Removed or replaced internals

- Continuous `Extent` mapping was replaced by scales and `DataScaleModel`.
- Duplicate price tick math was replaced by `PriceTickGenerator` helpers.
- Per-bar X-label generation was replaced by `TimeTickGenerator`.
- The chart's old array scans were replaced with `DataStore` lookup helpers.

### Public API renamed (`extent` → `scale`)

The internal `Extent`/`DataExtent` rename to `Scale`/`DataScaleModel` is now
carried through the public surface. These names changed (no compatibility
aliases):

| Old (0.9)                             | New (1.0)                         |
| ------------------------------------- | --------------------------------- |
| `chart.getVisibleExtent()`            | `chart.getVisibleScale()`         |
| `chart.recalculateVisibleExtent()`    | `chart.recalculateVisibleScale()` |
| `PaneledIndicator.createExtent()`     | `PaneledIndicator.createScale()`  |
| `PaneledIndicator` protected `extent` | protected `scale`                 |
| `PaneYAxisRenderOptions.extent`       | `PaneYAxisRenderOptions.scale`    |

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

1. Omit `controllers` for built-in chart types, or pass a chart-scoped
   `controllers` array to add custom types. Set
   `includeDefaultControllers: false` only for an exact controller set.
2. Confirm charts with missing calendar periods render as desired; blank weekend
   gaps are intentionally gone.
3. Replace custom overlay code with `ChartPlugin` where possible.
4. Update custom indicators to the plugin/pane lifecycle.
5. Replace old formatter subclasses with `DefaultFormatter` options or the new
   optional formatter methods.
6. Add `DrawingManager` only where users need interactive drawings, and persist
   its JSON snapshot in application state.
