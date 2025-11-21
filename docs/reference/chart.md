# FinancialChart API

`FinancialChart` is the main class exported by the library. It manages canvas creation, rendering, user input, indicators, and event emission.

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
  theme?: ChartTheme;
  locale?: string;
  formatter?: Formatter;
  localeValues?: Record<string, LocaleValues>;
};
```

| Option        | Description                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `type`        | Identifier for a registered controller such as `"candlestick"`, `"bar"`, or custom IDs.          |
| `stepSize`    | Time frame granularity in milliseconds. Incoming candles are snapped to this size.               |
| `maxZoom`     | Highest zoom factor before clamping user input.                                                  |
| `volume`      | Enables a histogram below the price chart.                                                       |
| `theme`       | `ChartTheme` object or the result of `mergeThemes`. Defaults to `defaultLightTheme`.             |
| `locale`      | Locale code forwarded to the formatter (defaults to `navigator.language`).                       |
| `formatter`   | Custom implementation of the `Formatter` interface. Defaults to `DefaultFormatter`.              |
| `localeValues`| Localized indicator labels keyed by locale. Merged with built-in English strings.                |

## Data contracts

```ts
type Candle = {
  time: number;     // UNIX timestamp in milliseconds
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
- When `timeRange` is `"auto"`, the chart calculates the visible window from the first data point to the last point plus one extra `stepSize`.

## Methods

### Data lifecycle

| Method                | Description                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `draw(data)`          | Replaces the full dataset and redraws the chart. Call this when symbols or timeframes change.   |
| `drawNextPoint(point)`| Adds or updates the latest candle. Keeps zoom/pan when possible, ideal for real-time feeds.     |
| `getData()`           | Returns the current dataset after it has been mapped to the active `stepSize`.                  |

### View and styling

| Method                         | Description                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `changeType(type)`            | Switches the active controller (candles, bars, area, etc.) while preserving zoom and pan state.              |
| `updateTheme(theme)`          | Deep merges a theme patch and redraws the view. Useful when toggling light/dark mode.                        |
| `setVolumeDraw(enabled)`      | Shows or hides the volume histogram without recreating the chart.                                            |
| `updateCoreOptions(range, stepSize, maxZoom)` | Rebuilds the internal state with new core settings. Resets zoom/pan because data is remapped. |
| `updateLocale(locale, values?)` | Changes the formatter locale and (optionally) overrides indicator labels for multiple languages.           |

### Query helpers

| Method                    | Description                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `getVisibleTimeRange()`   | Returns `{ start, end }` for the currently visible window factoring in zoom and pan offsets.                      |
| `getTimeRange()`          | Returns the configured base time range (before zoom/pan).                                                          |
| `getOptions()`            | Gives access to the current `ChartOptions` object (after merges).                                                 |
| `getTheme()`              | Returns the active `ChartTheme`.                                                                                  |
| `getController()`         | Returns the currently instantiated controller instance.                                                           |
| `getIndicators()` / `getPaneledIndicators()` / `getAllIndicators()` | Lists overlay indicators, paneled indicators, or both combined.         |

### Indicator management

```ts
chart.addIndicator(indicator: Indicator): void;
chart.removeIndicator(indicator: Indicator): void;
```

Use overlays for drawings on top of price data and `PaneledIndicator` implementations when you need a dedicated sub-chart. See the [Indicators reference](./indicators.md) for implementation details.

### Lifecycle

| Method        | Description                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `dispose()`   | Tears down event listeners, intersection/resize observers, and removes paneled indicator containers. Call this before removing the DOM node. |
| `requestRedraw(parts, immediate?)` | Schedules a render pass for the specified parts (`"controller"`, `"indicators"`, `"crosshair"`). Useful for advanced integrations or custom controllers. |

Because `FinancialChart` extends an event emitter, the usual `on(event, handler)` and `off(event, handler)` helpers are also available.

## Events

Subscribe with `chart.on(...)`. Each call returns an unsubscribe function.

| Event                         | Payload                                         | When it fires                                 |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------- |
| `click`                       | `{ event: PointerEvent, point: Candle }`        | User clicks the chart on desktop.             |
| `touch-click`                 | `{ event: TouchEvent, point: Candle }`          | User taps the chart on touch devices.         |
| `indicator-visibility-changed` | `{ indicator, visible }`                       | Indicator show/hide buttons are toggled.      |
| `indicator-settings-open`     | `{ indicator }`                                 | Settings button next to an indicator is used. |
| `indicator-remove`            | `{ indicator }`                                 | Indicator remove button is pressed.           |

## Controllers

Register controllers once before chart creation. The library ships with the following built-ins:

- `AreaController`
- `LineController`
- `BarController`
- `HollowCandleController`
- `CandlestickController`
- `SteplineController`
- `HLCAreaController`

Custom controllers can extend the base types to add indicators or overlays tailored to your application. Controllers receive access to the chart instance, canvas contexts, and the mapped `DataExtent`.
