# FinancialChart API

`FinancialChart` is the main class exported by the library. It manages canvas creation, index-based scales, rendering, user input, indicators, plugins, drawings, and event emission.

## Constructor

```ts
new FinancialChart(
  container: HTMLElement,
  timeRange: TimeRange | "auto",
  options: ChartOptions
);
```

### Parameters

- `container` – Element that hosts the chart canvases. The chart observes its size via `ResizeObserver`.
- `timeRange` – Initial visible span. Pass `"auto"` to derive it from incoming data.
- `options` – Controller, theme, and locale configuration (details below).

### ChartOptions

```ts
type ChartOptions = {
  type: ControllerType;
  stepSize: number;
  maxZoom: number;
  volume: boolean;
  controllers?: readonly ControllerConstructor[];
  theme?: ChartTheme;
  domAdapter?: ChartDOMAdapter;
  locale?: string;
  timeZone?: string;
  formatter?: Formatter;
  localeValues?: Record<string, LocaleValues>;
};
```

| Option         | Description                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `type`         | Identifier for an instance-registered controller such as `"candle"`, `"bar"`, or custom IDs.                                            |
| `stepSize`     | Time frame granularity in milliseconds. Incoming candles are snapped to this size.                                                      |
| `maxZoom`      | Highest zoom factor before clamping user input.                                                                                         |
| `volume`       | Enables a histogram below the price chart.                                                                                              |
| `controllers`  | Optional exact controller set for this chart. Omit to register the built-in controllers by default.                                     |
| `theme`        | `ChartTheme` object or the result of `mergeThemes`. Defaults to `defaultLightTheme`.                                                    |
| `domAdapter`   | `ChartDOMAdapter` implementation for DOM chrome: overlay, indicator labels/actions, and pane dividers. Defaults to `DefaultDOMAdapter`. |
| `locale`       | Locale code forwarded to the formatter. Defaults to the runtime locale when available, then `en-US`.                                    |
| `timeZone`     | IANA timezone forwarded to formatters that support `setTimeZone()`.                                                                     |
| `formatter`    | Custom implementation of the `Formatter` interface. Defaults to `DefaultFormatter`.                                                     |
| `localeValues` | Localized indicator labels keyed by locale. Merged with built-in English strings.                                                       |

Built-in controllers are registered on each chart by default:

```ts
const chart = new FinancialChart(root, "auto", {
  type: "candle",
  stepSize: 15 * 60 * 1000,
  maxZoom: 100,
  volume: true
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
  time: number; // UNIX timestamp in milliseconds
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
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

- Data **must** be sorted ascending by `time`.
- X coordinates are index-based: every data point occupies one ordinal slot, so weekends, holidays, and missing bars do not create blank horizontal gaps.
- When `timeRange` is `"auto"`, the window starts at the first data point and extends to either the last point plus one `stepSize` or a viewport-sized span (about 30-50 steps), whichever is larger.

## Methods

### Data lifecycle

| Method                 | Description                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `draw(data)`           | Replaces the full dataset and redraws the chart. Call this when symbols or timeframes change.                                                           |
| `drawNextPoint(point)` | Streams data: appends a new candle or merges into the latest slot when the timestamp falls in the same `stepSize` bucket. Keeps zoom/pan when possible. |
| `getData()`            | Returns the current dataset after it has been mapped to the active `stepSize`.                                                                          |

`drawNextPoint` behavior:

- Timestamps are snapped down to the nearest `stepSize`.
- If the new point lands after the last candle's slot, a new candle is appended.
- If the new point lands in the same slot as the last candle, high/low extend and close is replaced.
- With auto range enabled, the window expands and keeps the right edge in view unless you have panned away.

### View and styling

| Method                                        | Description                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `changeType(type)`                            | Switches the active controller (candles, bars, area, etc.) while preserving zoom and pan state.   |
| `updateTheme(theme)`                          | Deep merges a theme patch and redraws the view. Useful when toggling light/dark mode.             |
| `setVolumeDraw(enabled)`                      | Shows or hides the volume histogram without recreating the chart.                                 |
| `setPaneHeights(heights)`                     | Applies logical pixel pane heights keyed by pane id or pane order. Values are min-height clamped. |
| `updateCoreOptions(range, stepSize, maxZoom)` | Rebuilds the internal state with new core settings. Resets zoom/pan because data is remapped.     |
| `updateLocalization(options)`                 | Changes locale, timezone, formatter, and/or localized UI strings in one redraw.                   |
| `updateLocale(locale, values?)`               | Compatibility shorthand for `updateLocalization({ locale, localeValues: values })`.               |

### Extension registration

| Method                                | Description                                      |
| ------------------------------------- | ------------------------------------------------ |
| `registerController(ControllerClass)` | Adds a controller class to this chart instance.  |
| `registerDefaults()`                  | Adds every built-in controller to this instance. |

Omitting `options.controllers` calls `registerDefaults()` before the initial
controller is resolved. Provide `controllers` when you want an exact set, then
call `registerController(...)` or `registerDefaults()` later if extensions load
after construction. Registrations are not shared between charts.

### Query helpers

| Method                                                              | Description                                                                                 |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `getVisibleTimeRange()`                                             | Returns `{ start, end }` for the currently visible index window, mapped back to timestamps. |
| `getTimeRange()`                                                    | Returns the configured base time range (before zoom/pan).                                   |
| `getOptions()`                                                      | Gives access to the current `ChartOptions` object (after merges).                           |
| `getTheme()`                                                        | Returns the active `ChartTheme`.                                                            |
| `getPanes()` / `getMainPane()`                                      | Lists pane models or returns the main price pane.                                           |
| `getPaneHeights()`                                                  | Returns current logical pixel heights keyed by pane id.                                     |
| `getPlugins()`                                                      | Lists attached plugins.                                                                     |
| `getIndicators()` / `getPaneledIndicators()` / `getAllIndicators()` | Lists overlay indicators, paneled indicators, or both combined.                             |

### Indicator management

```ts
chart.addIndicator(indicator: Indicator): void;
chart.removeIndicator(indicator: Indicator): void;
```

Create indicators directly with `new MyIndicator(args)` and pass the instance to
`addIndicator`. Use overlays for drawings on top of price data and
`PaneledIndicator` implementations when you need a dedicated sub-chart. See the
[Indicators reference](./indicators.md) for implementation details.

Paneled indicator heights can be resized by dragging the pane divider. Use
`chart.setPaneHeights({ [paneId]: height })` to restore or persist a custom
layout programmatically; values are clamped to pane minimum heights.

### Plugins

```ts
chart.addPlugin(plugin: ChartPlugin): void;
chart.removePlugin(plugin: ChartPlugin): void;
```

Plugins receive a `ChartContext` during `attach(ctx)`, can render via
`beforeDraw`/`draw`/`afterDraw`, receive `onData`, `onVisibleRangeChanged`, and
`onPointer` notifications, and should release external resources in `detach()`.
Use the context's `getCanvasContext(layer)`, `getLogicalCanvas(layer)`,
`getPanes()`, `emit(...)`, and `requestRedraw(...)` helpers for extension-level
rendering and events.

Register render hooks with `ctx.onRenderStage(stage, callback)` when you need a
specific stage. Stages run in this order:

`beforeDraw → grid → axes → series → indicators → drawings → crosshair → afterDraw`

### Lifecycle

| Method                             | Description                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dispose()`                        | Tears down event listeners, the resize observer, and removes canvases plus paneled indicator containers. Call this before removing the DOM node.                                                 |
| `requestRedraw(parts, immediate?)` | Schedules a render pass for one or more layers. Use `"grid"`, `"axes"`, `"series"`, `"indicators"`, `"drawings"`, `"crosshair"`, or the compatibility alias `"controller"` for grid/axes/series. |

Because `FinancialChart` extends an event emitter, the usual `on(event, handler)` and `off(event, handler)` helpers are also available.

## Events

Subscribe with `chart.on(...)`. Each call returns an unsubscribe function.

| Event                          | Payload                                     | When it fires                                 |
| ------------------------------ | ------------------------------------------- | --------------------------------------------- |
| `click`                        | `{ event: PointerEvent, point: ChartData }` | User clicks the chart on desktop.             |
| `touch-click`                  | `{ event: TouchEvent, point: ChartData }`   | User taps the chart on touch devices.         |
| `indicator-visibility-changed` | `{ indicator, visible }`                    | Indicator show/hide buttons are toggled.      |
| `indicator-settings-open`      | `{ indicator }`                             | Settings button next to an indicator is used. |
| `indicator-remove`             | `{ indicator }`                             | Indicator remove button is pressed.           |
| `drawing-create`               | `{ drawing }`                               | Pointer-created drawing is finalized.         |
| `drawing-change`               | `{ drawing }`                               | Drawing anchors or content change.            |
| `drawing-select`               | `{ drawing }`                               | Drawing selection changes to a drawing.       |
| `drawing-delete`               | `{ drawing }`                               | Drawing is removed through `DrawingManager`.  |

## Controllers

Controllers are registered per chart instance. The library ships with the following built-ins:

- `AreaController`
- `LineController`
- `BarController`
- `HollowCandleController`
- `CandlestickController`
- `SteplineController`
- `HLCAreaController`

Custom controllers can extend the base types to add renderers tailored to your application. Controllers receive access to the chart instance, canvas contexts, visible data, and active scales.
