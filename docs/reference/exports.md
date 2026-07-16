# Public exports

The root entry is the application-facing convenience surface. It includes the
chart with every built-in controller, common built-ins, persistence, themes,
formatting, drawings, and synchronization plugins.

```ts
import { FinancialChart } from "@ardinsys/financial-charts";
import "@ardinsys/financial-charts/style.css";
```

This page is the root-export inventory. Detailed behavior lives in the linked
reference pages.

## Chart construction and data

| Exports | Reference |
| --- | --- |
| `FinancialChart`, `CoreChartOptions` | [FinancialChart](/reference/chart) |
| `ChartData`, `TimeRange` | [Data contracts](/reference/chart#data-contracts) |
| `ChartOptions`, `ChartOptionsUpdate`, `ChartOptionsSnapshot`, `ChartOptionsChangeEvent`, `ChartOptionKey`, `ChartLocalizationOptions` | [Options](/reference/chart#chartoptions) |
| `LocaleValues`, `LocaleValuesMap` | [i18n](/guide/i18n) |
| `ControllerID`, `ControllerType`, `ControllerConstructor` | [Controllers](/reference/engine#custom-controllers) |
| `ChartPaneSnapshot`, `PaneHeightsInput` | [View and panes](/reference/chart#view-and-styling) |
| `ChartCrosshairOptions`, `ChartCrosshairState`, `ChartCrosshairChangeEvent` | [View and interactions](/guide/view-and-interactions) |
| `IndicatorMutationOptions` | [Indicator management](/reference/chart#indicator-management) |

## Events, formatting, and themes

| Exports | Reference |
| --- | --- |
| `EventEmitter`, `ChartEventMap` | [Events](/reference/chart#events) |
| `Formatter`, `DefaultFormatter`, `DefaultFormatterOptions` | [Formatting](/guide/styling-and-localization#localization-and-formatter-overrides) |
| `ChartTheme`, `ChartThemeMap`, `ChartThemeKey`, `BuiltInChartThemeKey`, `ResolvedChartTheme`, `Gradient`, `defaultLightTheme`, `defaultDarkTheme` | [Styling](/guide/styling-and-localization) |
| `DefaultDOMAdapter` | [DOM adapter](/reference/dom-adapter) |

`ChartThemeMap` registers partial definitions by key. The chart resolves each
definition from its declared built-in base and exposes the active complete
`ResolvedChartTheme` through `getOptions()`.

## Chart and indicator state

| Exports | Reference |
| --- | --- |
| `CHART_STATE_VERSION`, `ChartState`, `ChartCoreState`, `ChartPaneState` | [State and persistence](/guide/state-and-persistence) |
| `ChartStateContributor`, `ChartStateSerializationOptions`, `ChartStateRestoreOptions`, `ChartStateRestoredEvent` | [Custom contributors](/guide/state-and-persistence#custom-contributors) |
| `INDICATOR_STATE_VERSION`, `IndicatorState`, `IndicatorStateOptions`, `IndicatorStateValue`, `IndicatorIdentityOptions`, `IndicatorResolver`, `restoreIndicator` | [Serializable indicator state](/reference/indicators#serializable-state) |
| `MovingAverageIndicator`, `MovingAverageOptions`, `MovingAverageTheme` | [Indicators](/reference/indicators) |

## Drawings and annotations

| Exports | Reference |
| --- | --- |
| `Drawing`, `DrawingOptions`, `DrawingAnchor`, `DrawingJSON` | [Drawing base](/reference/drawings) |
| `DrawingManager`, `DrawingManagerOptions`, `DrawingManagerJSON`, `DrawingFactory`, `DrawingDeserializer`, `DrawingMutationOptions`, `DrawingSelectionOptions` | [DrawingManager](/reference/drawings#manager-state-and-attachment) |
| `TrendLine`, `TrendLineOptions`, `HorizontalLine`, `HorizontalLineOptions`, `RectangleDrawing`, `RectangleDrawingOptions`, `TextDrawing`, `TextDrawingOptions` | [Built-in drawings](/reference/drawings#built-in-drawings) |
| `DrawingFinishedEvent`, `DrawingFinishedOperation`, `DrawingSelectionEvent` | [Drawing events](/reference/drawings#events) |
| `PriceAxisAnnotation`, `PriceAxisAnnotationOffscreenBehavior` | [Price-axis annotations](/reference/plugins#price-axis-annotations) |

## Plugins included at the root

| Exports | Reference |
| --- | --- |
| `ExtensionThemeResolver`, `ExtensionThemeDefaults`, `ExtensionThemeDefinition`, `ExtensionThemeMap` | [Extension themes](/reference/plugins#extension-themes) |
| `ChartSyncPlugin`, `ChartSyncPluginOptions`, `ChartSyncCrosshairSnapshot`, `ChartSyncIndicatorSnapshot`, `ChartSyncMessage`, `ChartSyncMessageSource`, `ChartSyncMessageHandler`, `ChartSyncPostMessageOptions` | [ChartSyncPlugin](/reference/plugins#chartsyncplugin) |
| `DrawingAxisBoundsPlugin`, `DrawingAxisBoundsPluginOptions`, `DrawingAxisBoundKind`, `DrawingAxisBoundsLabels`, `DrawingAxisBoundsLabelOptions`, `DrawingAxisBoundsLabelContext`, `DrawingAxisBoundsValueContext`, `DrawingAxisBoundsTextContext`, `DrawingAxisBoundsTheme` | [Drawing axis bounds](/reference/plugins#drawing-axis-bounds-plugin) |
| `DrawingSelectionPlugin`, `DrawingSelectionPluginOptions`, `DrawingSelectionCallback` | [Drawing selection](/reference/plugins#drawing-selection-plugin) |

## Built-in controllers

The root exports `AreaController`, `BarController`, `CandlestickController`,
`HLCAreaController`, `HollowCandleController`, `LineController`, and
`SteplineController`. Importing the root intentionally includes all of them.

For a controller-curated bundle, import `FinancialChart` from
`@ardinsys/financial-charts/core` and concrete controllers from:

- `@ardinsys/financial-charts/controllers/area`
- `@ardinsys/financial-charts/controllers/bar`
- `@ardinsys/financial-charts/controllers/candle`
- `@ardinsys/financial-charts/controllers/hlc-area`
- `@ardinsys/financial-charts/controllers/hollow-candle`
- `@ardinsys/financial-charts/controllers/line`
- `@ardinsys/financial-charts/controllers/stepline`

## Authoring entry points

- `@ardinsys/financial-charts/extensions` exports plugin, indicator, drawing,
  annotation, DOM-adapter, `ChartCanvasLayer`, and `ChartRedrawPart` authoring
  contracts. See [Plugins](/reference/plugins),
  [Indicators](/reference/indicators), [Drawings](/reference/drawings), and the
  [DOM adapter](/reference/dom-adapter).
- `@ardinsys/financial-charts/engine` adds controllers, scales, panes, render
  stages, ticks, palette selection, and low-level DOM/canvas helpers. See
  [Engine](/reference/engine) and [Scales](/reference/scales).

Package source files, `dist/*` implementation paths, test fixtures, icon source
strings, and the internal default-controller registry are not public subpaths.
