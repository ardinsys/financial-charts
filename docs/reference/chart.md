# FinancialChart API

`FinancialChart` is the main class exported by the library. This page highlights the most common methods and options.

## Constructor

```ts
new FinancialChart(
  container: HTMLElement,
  timeRange: { start: number; end: number } | "auto",
  options: ChartOptions
)
```

- `container` — Element that hosts the canvas.
- `timeRange` — Initial visible time span or `"auto"` to derive from data.
- `options` — Controller, theme, and locale configuration.

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

- `type` — Identifier for the registered controller (for example `"candlestick"` or `"hlc-area"`).
- `stepSize` — Time frame granularity in milliseconds.
- `maxZoom` — Maximum zoom factor the user may reach before data remapping is triggered.
- `volume` — Enables a volume histogram under the main chart.
- `theme` — Theme object or merged theme returned from `mergeThemes`.
- `locale` — Locale code forwarded to the formatter.
- `formatter` — Custom formatter instance. Defaults to `DefaultFormatter`.
- `localeValues` — Localized indicator labels keyed by locale. Merged with the defaults internally.

## Data methods

```ts
chart.draw(data: Candle[]): void;
chart.drawNextPoint(point: Candle): void;
```

Both methods expect ascending timestamps. `draw` replaces the full dataset, while `drawNextPoint` appends a single item.

## View control

```ts
chart.changeType(controller: string): void;
chart.updateTheme(theme: ChartTheme): void;
chart.updateLocale(locale: string, values?: LocaleValues): void;
chart.setVolumeDraw(enabled: boolean): void;
chart.updateCoreOptions(
  timeRange: { start: number; end: number } | "auto",
  stepSize: number,
  maxZoom: number
): void;
```

Use these methods to react to UI actions or preference toggles without rebuilding the chart.

## Controllers

Register controllers once before chart creation. The library ships with the following built-ins:

- `AreaController`
- `LineController`
- `BarController`
- `HollowCandleController`
- `CandlestickController`
- `SteplineController`
- `HLCAreaController`

Custom controllers can extend the base types to add indicators or overlays tailored to your application.
