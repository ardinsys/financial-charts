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

The old `draw(data)` and `drawNextPoint(point)` methods were removed rather
than retained as compatibility aliases.

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
- Use projection helpers on `ChartControllerContext`,
  `IndicatorDrawingContext`, or drawing render contexts. Plugins that need
  lower-level projection can use panes from `ChartContext.getPanes()`.
  Application code no longer reads chart scales directly.
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
- Use `updateOptions({ timeRange, stepSize, maxZoom })` when changing symbol,
  timeframe, or base range. `updateCoreOptions` was removed.
- Avoid persisting old zoom/pan scalar values from v0.9; persist the data range,
  `getVisibleTimeRange()`, or `getVisibleLogicalRange()` depending on your UI.

### Runtime options use one command

The chart no longer carries convenience aliases for individual option groups:

| Removed | Replacement |
| --- | --- |
| `changeType(type)` | `updateOptions({ type })` |
| `updateTheme(theme)` | `updateOptions({ theme })` |
| `setVolumeDraw(volume)` | `updateOptions({ volume })` |
| `updateLocalization(options)` | `updateOptions(options)` |
| `updateLocale(locale, localeValues)` | `updateOptions({ locale, localeValues })` |

One patch validates and publishes related option changes as one transaction.

### Render invalidation uses named layers

`ChartContext.requestRedraw()` targets render layers and is scoped to the
owning plugin attachment:

```ts
ctx.requestRedraw([
  "grid",
  "axes",
  "series",
  "indicators",
  "drawings",
  "annotations"
]);
```

The full layer set is `"grid"`, `"axes"`, `"series"`, `"indicators"`,
`"drawings"`, `"annotations"`, and `"crosshair"`.

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

Indicator type, instance, and label identity are now separate:

- Add a stable static `ID` to every custom indicator hierarchy for factory and
  sync lookup. Subclasses may override it when they represent a distinct type.
- Replace the removed default option `key` with the required `labelKey`.
- Pass `{ instanceId }` to the constructor when restoring a persisted
  indicator. Otherwise the base class generates a unique instance ID.
- Replace removed `getKey()` calls with `getInstanceId()` and removed
  constructor `key` values with `instanceId`.
- Use `getLabelKey()` for application label lookup and `getIndicatorType()` for
  factory lookup.
- `clone()` now creates a distinct instance ID; `copyFrom()` preserves the
  target identity.

Charts reject duplicate instance IDs and expose `getIndicatorById()` and
`getIndicatorsByType()`. Indicator event payloads expose the indicator instance;
read its identity through the methods above. Indicator synchronization uses the
instance ID so multiple instances of one type no longer overwrite one another.

Use `indicator.toJSON()` for versioned, JSON-safe indicator state and
`restoreIndicator(state, resolver)` to rebuild it. The resolver is
application-owned and supplies concrete classes and runtime dependencies; no
global registry is installed. Default state excludes label metadata, themes,
DOM state, computed data, and other instance fields. Indicators with non-JSON
options should override `serializeStateOptions()` and
`restoreStateOptions()`.

Replace application-owned chart restoration loops, manual option-field
deletion, and deferred `setTimeout()` attachment with the complete state API:

```ts
const stored = chart.toJSON({ contributors: [drawingManager] });

chart.restoreState(stored, {
  indicatorResolver,
  contributors: [drawingManager]
});
```

The state includes core chart options, the precise visible window, pane
identity and heights, and serialized indicators. `DrawingManager` can be
included as a state contributor. Chart data and runtime services remain
application-owned. Restoration validates dependencies first, suppresses
intermediate public mutations, redraws once, and emits `state-restored` when
complete. It can run before data is loaded; the restored window is applied by
the next `setData()` call.

`ChartSyncPlugin` now uses `IndicatorState` rather than cloned indicator
instances. Pass the same `indicatorResolver` when indicator synchronization is
enabled, or set `indicators: false` for groups that only synchronize view,
crosshair, drawings, or custom messages.

### Paneled indicators are pane-backed

Paneled indicators are laid out through `Pane` models that share the chart's
`TimeScale` and own their `PriceScale` and Y-axis region. Crosshair and pointer
events are routed by pane hit testing.

What to update:

- Use the `pane` passed in `InitParams` when you need pane geometry or scales.
- Move pane content into `drawPane(context)` so the base class owns background,
  grid, axes, visibility, and scale synchronization.

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
`chart.updateOptions({ locale, timeZone, formatter, localeValues })`
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
Controller registration now belongs to each `FinancialChart` instance.

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
const chart = new FinancialChart(root, {
  timeRange: "auto",
  type: "candle",
  stepSize: 15 * 60 * 1000,
  maxZoom: 100,
  volume: true
});

chart.registerController(CustomController);
```

### Custom controllers use named engine contracts

Custom controller crosshair fields are no longer positional boolean arrays.
Return named `ChartData` fields, which removes array-length and OHLCV-position
coupling:

```ts
getCrosshairValues(): readonly ChartDataValueKey[] {
  return ["close", "volume"];
}
```

Import `ChartController`, `ChartDataValueKey`, `DataScaleModel`, and related
scale contracts from `@ardinsys/financial-charts/engine`. Tick generation now
accepts a sorted public `times: readonly number[]` input instead of the internal
data store. `TimeScale`, `PriceScale`, and pane range getters return stable
immutable snapshots rather than caller-owned mutable objects.

The chart-coupled `randomColor(chart, index)` helper was removed. Use
`paletteColor(colors, index)` from the engine entry and pass the desired palette
explicitly.

`FinancialChart.registerIndicator` and `FinancialChart.createIndicator` were
removed rather than replaced. Instantiate indicators directly and add them to the
chart:

```ts
const indicator = new MovingAverageIndicator(null, { period: 20 });
chart.addIndicator(indicator);
```

### Events are generic and extensible

The event emitter accepts typed `chart.on(...)` subscriptions, and the built-in
event map includes indicator and drawing events. Plugin authors can use the
generic event emitter types for custom event maps.

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

The base `Indicator` builds an `IndicatorLabelModel` (`instanceId`, `typeId`,
`labelKey`, name from localized `names`, actions, visibility) and hands it to
the adapter. Multi-color values
(Bollinger, MACD) are expressed as multiple
`segments`. This is what lets DOM adapters render labels using app-owned
markup, styling, or framework components.

- New option: `new FinancialChart(el, { timeRange: range, ..., domAdapter })`. Omit it to
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

### Package entry points are split by audience

The root package now contains application-facing chart construction, options,
data, state, built-in controllers and indicators, drawings, plugins, themes,
formatting, and common events. Import extension-authoring contracts from
`@ardinsys/financial-charts/extensions` and low-level chart internals from
`@ardinsys/financial-charts/engine`:

```ts
import { FinancialChart, MovingAverageIndicator } from "@ardinsys/financial-charts";
import {
  Indicator,
  PaneledIndicator,
  type ChartPlugin
} from "@ardinsys/financial-charts/extensions";
import {
  DataScaleModel,
  Pane,
  TimeScale
} from "@ardinsys/financial-charts/engine";
```

| Previously imported from the root | v1 entry point |
| --------------------------------- | -------------- |
| `Indicator`, `PaneledIndicator`, indicator drawing/label contracts | `./extensions` |
| `ChartPlugin`, `ChartContext`, pointer and drawing authoring contracts | `./extensions` |
| `ChartDOMAdapter` and adapter model/handle contracts | `./extensions` |
| `ChartController`, scales, panes, render stages, ticks, DOM/canvas helpers | `./engine` |

`TestIndicator` and the default adapter's raw icon strings are implementation
fixtures and are no longer exported. Applications should provide their own
paneled indicator class and icon assets.

For the `commons-js` financial indicator package, move base indicator,
paneled-indicator, drawing-context, and label-contract imports to
`@ardinsys/financial-charts/extensions`. Move `DataScaleModel`, scale contracts,
and `paletteColor` to `@ardinsys/financial-charts/engine`. Concrete chart APIs,
`ChartData`, themes, formatter types, and indicator state restoration remain on
the root entry. This is an import-path migration only; updating the downstream
indicator implementations remains a separate repository change.

## Removed or replaced internals

- Continuous `Extent` mapping was replaced by scales and `DataScaleModel`.
- Duplicate price tick math was replaced by `PriceTickGenerator` helpers.
- Per-bar X-label generation was replaced by `TimeTickGenerator`.
- The chart's old array scans were replaced with `DataStore` lookup helpers.

### Extent authoring contracts renamed to scales

The internal `Extent`/`DataExtent` rename to `Scale`/`DataScaleModel` is now
carried through the public surface. These names changed (no compatibility
aliases):

| Old (0.9)                             | New (1.0)                        |
| ------------------------------------- | -------------------------------- |
| `chart.getVisibleExtent()`            | Removed from the application API |
| `chart.recalculateVisibleExtent()`    | Removed from the application API |
| `PaneledIndicator.createExtent()`     | `PaneledIndicator.createScale()` |
| `PaneledIndicator` protected `extent` | protected `scale`                |
| `PaneYAxisRenderOptions.extent`       | `PaneYAxisRenderOptions.scale`   |

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
