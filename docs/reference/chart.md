# FinancialChart API

`FinancialChart` is the main class exported by the library. It manages canvas creation, index-based scales, rendering, user input, indicators, plugins, drawings, and event emission.

## Package entry points

- `@ardinsys/financial-charts` contains application-facing chart APIs and built-ins.
- `@ardinsys/financial-charts/core` provides the controller-neutral chart for
  tree-shaken controller selection.
- `@ardinsys/financial-charts/extensions` contains indicator, plugin, drawing,
  annotation, and DOM-adapter authoring contracts.
- `@ardinsys/financial-charts/engine` contains controller, scale, pane,
  render-pipeline, tick, and low-level DOM/canvas contracts.

## Constructor

```ts
new FinancialChart(
  container: HTMLElement,
  options: ChartOptions
);
```

### Parameters

- `container` – Element that hosts the chart canvases. The chart observes its size via `ResizeObserver`.
- `options` – Controller, theme, and locale configuration (details below).

### ChartOptions

```ts
type ChartOptions = {
  type?: ControllerType;
  timeRange?: TimeRange | "auto";
  stepSize: number;
  maxZoom?: number;
  volume?: boolean;
  controllers?: readonly ControllerConstructor[];
  includeDefaultControllers?: boolean;
  theme?: ChartTheme;
  domAdapter?: ChartDOMAdapter;
  locale?: string;
  timeZone?: string;
  formatter?: Formatter;
  localeValues?: Record<string, LocaleValues>;
};
```

| Option                      | Description                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                      | Identifier for an instance-registered controller. Defaults to `"candle"` on the root chart and the first supplied controller on the core chart. |
| `timeRange`                 | Initial visible span. Defaults to `"auto"`, which derives the range from incoming data.                                                 |
| `stepSize`                  | Time frame granularity in milliseconds. Incoming candles are snapped to this size.                                                      |
| `maxZoom`                   | Highest zoom factor before clamping user input. Defaults to `100`.                                                                      |
| `volume`                    | Enables a histogram below the price chart. Defaults to `true`.                                                                          |
| `controllers`               | Additional controller classes registered after the built-ins.                                                                          |
| `includeDefaultControllers` | Controls class-provided defaults. The root chart defaults to `true`; the controller-neutral core defaults to `false`.                   |
| `theme`                     | `ChartTheme` object or the result of `mergeThemes`. Defaults to `defaultLightTheme`.                                                    |
| `domAdapter`                | `ChartDOMAdapter` implementation for DOM chrome: overlay, indicator labels/actions, and pane dividers. Defaults to `DefaultDOMAdapter`. |
| `locale`                    | Locale code forwarded to the formatter. Defaults to the runtime locale when available, then `en-US`.                                    |
| `timeZone`                  | IANA timezone forwarded to formatters that support `setTimeZone()`.                                                                     |
| `formatter`                 | Custom implementation of the `Formatter` interface. Defaults to `DefaultFormatter`.                                                     |
| `localeValues`              | Localized indicator labels keyed by locale. Merged with built-in English strings.                                                       |

`stepSize` and `maxZoom` must be finite and greater than zero. Explicit
`timeRange` boundaries must be finite with `end >= start`. Invalid constructor
options throw before chart DOM is created.

`controllers`, `includeDefaultControllers`, and `domAdapter` are
constructor-only. Runtime changes use `ChartOptionsUpdate`:

```ts
type ChartOptionsUpdate = {
  type?: ControllerType;
  timeRange?: TimeRange | "auto";
  stepSize?: number;
  maxZoom?: number;
  volume?: boolean;
  theme?: ChartTheme;
  locale?: string;
  timeZone?: string;
  formatter?: Formatter;
  localeValues?: Record<string, LocaleValues>;
};
```

Built-in controllers are registered on each chart by default:

```ts
const chart = new FinancialChart(root, {
  timeRange: "auto",
  stepSize: 15 * 60 * 1000
});
```

#### Localization options

- `locale` keeps the formatter and indicator UI in sync. `updateLocalization({ locale })` recomputes labels and rerenders the chart.
- `timeZone` controls date/time labels when the active formatter supports `setTimeZone()`. It is used by `DefaultFormatter`.
- `localeValues` is merged with the internal `default` block (`Show/Hide/Settings/Remove` + OHLCV names). Supply only the locales you need; missing entries fall back to `default`.
- `formatter` can extend `DefaultFormatter` to reuse axis formatting while customizing tooltip dates/prices.

#### DOM chrome options

- `domAdapter` controls the non-canvas UI seam. Use `DefaultDOMAdapter` plus the built-in `fci-*` classes for CSS restyling, or pass a custom `ChartDOMAdapter` to replace indicator labels/actions and pane dividers with app-owned DOM.
- Canvas-rendered surfaces such as candles, axes, grid, crosshair labels, and volume remain theme-driven. Use `mergeThemes()` and `updateTheme()` for those.
- See [Design-system adapter](/guide/design-system-adapter) for the default class list and a custom adapter example.

## Data contracts

```ts
// Exported as `ChartData` from "@ardinsys/financial-charts"
type ChartData = {
  readonly time: number; // UNIX timestamp in milliseconds
  readonly open?: number | null;
  readonly high?: number | null;
  readonly low?: number | null;
  readonly close?: number | null;
  readonly volume?: number | null;
};

type TimeRange = { start: number; end: number };

type LocaleValues = {
  common: {
    sources: {
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    };
  };
  indicators: {
    actions: {
      show: string;
      hide: string;
      settings: string;
      remove: string;
    };
  };
};
```

- All present `ChartData` values must be finite numbers; zero is valid.
- `setData` copies and sorts input by `time`; caller-owned arrays and points are not mutated.
- Points sharing a snapped bucket merge using first available open, greatest
  high, smallest low, last available close, and summed volume. Missing fields
  do not erase numeric values; explicit `null` remains when no numeric value was
  supplied for that field.
- X coordinates are index-based: every data point occupies one ordinal slot, so weekends, holidays, and missing bars do not create blank horizontal gaps.
- When `timeRange` is `"auto"`, the window starts at the first data point and extends to either the last point plus one `stepSize` or a viewport-sized span (about 30-50 steps), whichever is larger.

## Methods

### Data lifecycle

| Method                 | Description                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setData(data)`        | Copies, sorts, buckets, and replaces the full dataset. Passing `[]` clears all data-dependent state immediately.                                       |
| `updateData(point)`    | Streams a monotonic point: appends or merges it into the newest `stepSize` bucket while preserving zoom/pan where possible.                            |
| `clearData()`          | Convenience equivalent of `setData([])`.                                                                                                                |
| `getData()`            | Returns a frozen readonly snapshot of the dataset after it has been mapped to the active `stepSize`.                                                    |

Each `getData()` call returns a new frozen array. Stored points are frozen copies
unless the caller supplied an already frozen point, so later mutation of the
input array or mutable input objects cannot alter chart state.

`updateData` behavior:

- Timestamps are snapped down to the nearest `stepSize`.
- If the new point lands after the last candle's slot, a new candle is appended.
- If the new point lands in the same slot as the last candle, the full-dataset field merge rules apply.
- Equal timestamps are accepted. A timestamp older than the latest raw input
  throws `RangeError`, even when both values would map to the same bucket; use
  `setData()` for corrections.
- With auto range enabled, the window expands and keeps the right edge in view unless you have panned away.

### View and styling

| Method                          | Description                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| `updateOptions(patch)`          | Updates any runtime chart options in one classified reset/remap/redraw cycle.                     |
| `changeType(type)`              | Shorthand for `updateOptions({ type })`.                                                          |
| `updateTheme(theme)`            | Shorthand for `updateOptions({ theme })`; theme patches are deeply merged.                        |
| `setVolumeDraw(enabled)`        | Shorthand for `updateOptions({ volume: enabled })`.                                               |
| `setPaneHeights(heights)`       | Applies logical pixel pane heights keyed by pane id or pane order. Values are min-height clamped. |
| `updateLocalization(options)`   | Shorthand for updating locale, timezone, formatter, and/or localized UI strings.                  |
| `updateLocale(locale, values?)` | Convenience shorthand for updating `locale` and `localeValues`.                                  |
| `setCrosshair(options)`         | Sets the native crosshair to the nearest visible data point for a timestamp.                      |
| `clearCrosshair()`              | Clears the native crosshair and resets pointer-aware indicator labels.                            |

```ts
chart.updateOptions({
  type: "line",
  theme: darkTheme,
  locale: "hu-HU"
});
```

The complete patch is validated before chart state changes. One effective patch
emits one `options-change` event and schedules at most one redraw. Unchanged
effective values do not emit, reset the view, or redraw. Changing `stepSize`
remaps the original dataset; changing `timeRange` or `stepSize` resets zoom and
pan. A type change preserves the visible window. Theme patches are deeply
merged. Changing only `maxZoom` affects subsequent zoom input and does not
redraw immediately.

`setCrosshair({ time, y?, price?, paneId? })` is intended for synchronized
charts and other external pointer controllers. It resolves `time` against the
target chart's own data, so charts can have different tick sizes. Pass `y` for a
chart-relative logical Y coordinate, or pass `price`/`paneId` to project a pane
price on the target chart. It returns the resolved crosshair state, or
`undefined` when the requested time is not visible on the target chart.

### Extension registration

| Method                                | Description                                      |
| ------------------------------------- | ------------------------------------------------ |
| `registerController(ControllerClass)` | Adds a controller class to this chart instance.  |
| `registerDefaults()`                  | Re-registers the defaults provided by this chart class. It is a no-op on the controller-neutral core chart. |

Built-ins are registered before `options.controllers`, so custom controllers are
additive and may intentionally replace a built-in with the same ID. For an exact
set, pass `includeDefaultControllers: false`; the supplied list must then include
the initial `type`. Call `registerController(...)` when extensions load after
construction. Registrations are not shared between charts.

Controller constructors receive `ResolvedChartOptions`: a readonly contract
with defaults populated for controllers, theme, formatting, localization, and
DOM integration.

### Tree-shakable controller setup

The root entry is the convenience API: `FinancialChart` includes every built-in
controller and custom `controllers` are additive. For a smaller controller set,
import the controller-neutral chart and individual controller entry points:

```ts
import { FinancialChart } from "@ardinsys/financial-charts/core";
import { LineController } from "@ardinsys/financial-charts/controllers/line";

const chart = new FinancialChart(container, {
  controllers: [LineController],
  stepSize: 60_000
});
```

The core entry does not reference concrete controllers, so bundlers can exclude
every controller that is not imported. Its required `controllers` list is exact,
and omitting `type` selects the first class in that list. Setting
`includeDefaultControllers: false` on the root chart changes runtime
registration, but it cannot remove controllers already imported by the root
entry.

### Query helpers

| Method                                                              | Description                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `getVisibleLogicalRange()`                                          | Returns the precise fractional logical-index window.                                        |
| `setVisibleIndexRange(range)`                                       | Sets, clamps, rescales, notifies, and redraws a fractional logical-index window.             |
| `getVisibleTimeRange()`                                             | Returns the whole-bar window as an end-exclusive timestamp range.                            |
| `setVisibleTimeRange(range)`                                        | Selects whole bars with timestamps in the end-exclusive range.                               |
| `getVisibleTimeWindow()`                                            | Returns interpolated timestamps that preserve the fractional logical window.                 |
| `setVisibleTimeWindow(range)`                                       | Restores an interpolated fractional window, primarily for pan/zoom synchronization.          |
| `getTimeRange()`                                                    | Returns the configured base time range (before zoom/pan).                                   |
| `getOptions()`                                                      | Returns an immutable public snapshot of the resolved chart configuration.                  |
| `getTheme()`                                                        | Returns the active `ChartTheme`.                                                            |
| `getPanes()` / `getMainPane()`                                      | Returns a readonly pane snapshot or the main price pane.                                    |
| `getPaneHeights()`                                                  | Returns current logical pixel heights keyed by pane id.                                     |
| `getPlugins()`                                                      | Returns a readonly snapshot of attached plugins.                                            |
| `getIndicators()` / `getPaneledIndicators()` / `getAllIndicators()` | Returns readonly snapshots of overlay, paneled, or all indicators.                          |
| `getIndicatorById(instanceId)`                                      | Returns the indicator with that unique instance ID, if attached.                            |
| `getIndicatorsByType(typeId)`                                       | Returns a readonly snapshot of every indicator with the stable type ID.                     |
| `getCrosshairState()`                                               | Returns the current crosshair state, or `undefined` when hidden.                            |

`getOptions()` returns controller, timeframe, theme, and localization data. Its
nested time range, theme, locale, and controller collections are immutable and
cannot mutate the chart. The same snapshot object is returned until an
effective option or controller-registration change replaces it. Use
`getFormatter()` for the active formatter; DOM adapters are available to
extensions through `ChartContext`.

View setters enforce a minimum one-bar span and clamp to the chart's current
index bounds. They synchronously update the visible price scale, notify
`onVisibleRangeChanged` once per effective change, and redraw all dependent
layers, including drawings and crosshair. Reapplying the current range does
nothing. All view setters are no-ops until data exists, and non-finite
boundaries throw `RangeError` once data is present.

With no data, the time getters return the current configured range (or
`{ start: 0, end: 0 }` for an unresolved auto range) and the logical getter
returns the empty index window. View setters intentionally do not validate or
store a pending range while the chart is empty.

### Chart state

Use `toJSON()` and `restoreState()` to persist the chart configuration and
view as one versioned, JSON-safe value:

```ts
const state = chart.toJSON({ contributors: [drawingManager] });
localStorage.setItem("price-chart", JSON.stringify(state));

const stored = localStorage.getItem("price-chart");
if (stored) {
  chart.restoreState(JSON.parse(stored), {
    indicatorResolver: ({ typeId }) => {
      switch (typeId) {
        case MovingAverageIndicator.ID:
          return new MovingAverageIndicator();
        case OrdersIndicator.ID:
          return new OrdersIndicator(orderService);
        default:
          return undefined;
      }
    },
    contributors: [drawingManager]
  });
}
```

`ChartState` contains the controller type, configured time range, `stepSize`,
`maxZoom`, volume visibility, the precise fractional visible window, pane IDs
and heights, and every indicator's `IndicatorState`. Multiple instances of one
indicator type retain their distinct instance IDs. Data is deliberately not
included: load symbol or order data through its normal application service.
Theme, localization, formatters, DOM adapters, crosshair state, and arbitrary
plugin runtime state are also outside this persistence contract.

Pass a `DrawingManager` directly as a contributor to include its existing
drawing JSON. Other plugins can participate by implementing a unique `key`,
`toJSON()`, and `fromJSON(state)`. A contribution present in stored state must
have a matching contributor during restoration.

The target chart must already have the stored controller type registered.
Indicator state requires an application-owned `indicatorResolver`, which is
where custom constructors receive runtime dependencies. Attach stateful plugins
before calling `restoreState()`. Restoration suppresses intermediate option,
indicator, and drawing events, coalesces rendering, and emits one
`state-restored` event with the final state. If data has not arrived yet, the
precise visible window is retained and applied by the next `setData()` call.

### Indicator management

```ts
chart.addIndicator(indicator: Indicator): () => void;
chart.removeIndicator(indicator: Indicator): boolean;
```

Create indicators directly with `new MyIndicator(args)` and pass the instance to
`addIndicator`. Use overlays for drawings on top of price data and
`PaneledIndicator` implementations when you need a dedicated sub-chart. See the
[Indicators reference](./indicators.md) for implementation details.

The disposer returned by `addIndicator()` removes that instance once; later
calls are no-ops. Adding an already attached instance or a duplicate instance
ID throws.

Paneled indicator heights can be resized by dragging the pane divider. Use
`chart.setPaneHeights({ [paneId]: height })` to restore or persist a custom
layout programmatically; values are clamped to pane minimum heights.

### Plugins

```ts
chart.addPlugin(plugin: ChartPlugin): () => void;
chart.removePlugin(plugin: ChartPlugin): boolean;
```

Plugins receive a `ChartContext` during `attach(ctx)`, can render via
`beforeDraw`/`draw`/`afterDraw`, receive `onData`, `onVisibleRangeChanged`,
`onOptionsChanged`, `onPointer`, and `onDrawingFinished` notifications, and
should release external resources in `detach()`. Current options, data, and
visible range are delivered immediately after attachment.
Use the context's `getCanvasContext(layer)`, `getLogicalCanvas(layer)`,
`getPanes()`, `setPriceAxisAnnotations(...)`, `emit(...)`, and
`requestRedraw(...)` helpers for extension-level rendering and events.

Plugin instances and keys must be unique within a chart. The disposer returned
by `addPlugin()` is idempotent; direct removal likewise returns whether the
plugin was attached.

Register render hooks with `ctx.onRenderStage(stage, callback)` when you need a
specific stage. Stages run in this order:

`beforeDraw → grid → axes → series → indicators → drawings → annotations → crosshair → afterDraw`

Hooks registered for `series` run after the active controller's series draw and
before indicators, drawings, annotations, and crosshair. That is the right layer for
comparison-series plugins that should sit above the main controller but below
everything else.

### Lifecycle

| Method                             | Description                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dispose()`                        | Idempotently aborts extension scopes, detaches indicators/plugins, clears listeners and observers, and removes chart-owned DOM. Call it before removing the host.                                |
| `requestRedraw(parts, immediate?)` | Schedules a render pass for one or more of `"grid"`, `"axes"`, `"series"`, `"indicators"`, `"drawings"`, `"annotations"`, and `"crosshair"`. |

Because `FinancialChart` extends an event emitter, the usual `on(event, handler)` and `off(event, handler)` helpers are also available.

## Events

Subscribe with `chart.on(...)`. Each call returns an unsubscribe function.

| Event                          | Payload                                                   | When it fires                                 |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------- |
| `click`                        | `{ event: PointerEvent, point: ChartData }`               | User clicks the chart on desktop.             |
| `touch-click`                  | `{ event: TouchEvent, point: ChartData }`                 | User taps the chart on touch devices.         |
| `crosshair-change`             | `{ time, y, pane, dataPoint }`                            | Native or programmatic crosshair moves.       |
| `crosshair-clear`              | `{}`                                                      | Native or programmatic crosshair clears.      |
| `options-change`               | `{ previous, current, changedKeys }`                      | Effective runtime options change.             |
| `state-restored`               | `{ state }`                                               | Complete chart state has been restored.       |
| `indicator-add`                | `{ indicator }`                                           | Indicator is added to the chart.              |
| `indicator-change`             | `{ indicator }`                                           | Indicator options are updated.                |
| `indicator-visibility-changed` | `{ indicator, visible }`                                  | Indicator show/hide buttons are toggled.      |
| `indicator-settings-open`      | `{ indicator }`                                           | Settings button next to an indicator is used. |
| `indicator-remove`             | `{ indicator }`                                           | Indicator is removed from the chart.          |
| `drawing-create`               | `{ drawing }`                                             | Pointer-created drawing is finalized.         |
| `drawing-change`               | `{ drawing }`                                             | Drawing anchors or content change.            |
| `drawing-finished`             | `{ drawing, operation, id, type, paneId, anchors, json }` | Pointer create or drag operation completes.   |
| `drawing-select`               | `{ drawing?, id?, type?, paneId?, anchors?, json? }`      | Drawing selection changes or clears.          |
| `drawing-delete`               | `{ drawing }`                                             | Drawing is removed through `DrawingManager`.  |

## Controllers

Controllers are registered per chart instance. The library ships with the following built-ins:

- `AreaController`
- `LineController`
- `BarController`
- `HollowCandleController`
- `CandlestickController`
- `SteplineController`
- `HLCAreaController`

Custom controllers can extend the base types to add renderers tailored to your application. Controllers receive access to the chart instance, canvas contexts, visible data, and active scales. Override `getTimeAnchorAlignment()` when drawings, crosshair, axis labels, and indicator helpers should snap to a different point inside each time slot than the default center.
Import controller base classes and their scale/render dependencies from
`@ardinsys/financial-charts/engine`.
