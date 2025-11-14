# Indicators

Indicators can be drawn either on top of the main price chart (overlay indicators) or inside dedicated panels stacked underneath (paneled indicators). Both types inherit from the `Indicator` base class and share the same lifecycle hooks.

## Base indicator API

```ts
import { Indicator, type DefaultIndicatorOptions } from "@ardinsys/financial-charts";

abstract class MyIndicator extends Indicator<MyTheme, MyOptions> {
  public getDefaultOptions(): MyOptions { /* ... */ }
  public getDefaultThemes(): Record<string, MyTheme> { /* ... */ }
  public draw(): void { /* render using chart contexts */ }
  public updateLabel(dataTime?: number): void { /* sync label contents */ }
}
```

### DefaultIndicatorOptions

Every indicator merges its supplied options with these defaults:

| Field           | Description                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `key`           | Unique identifier (for labels and debugging).                                                             |
| `names`         | Localized display names keyed by locale (`default` is used as a fallback).                                |
| `labelTemplate` | HTML template used for the indicator pill. Two versions are usually provided (`light` and `dark`).        |

The base class automatically wires the template buttons:

- Show/hide toggles (`data-id="show"` / `"hide"`).
- Settings button (`indicator-settings-open` event).
- Remove button (`indicator-remove` event).

### Lifecycle hooks

- `setChart(chart)` is called when the indicator is attached. Use it to cache the reference and read `chart.getOptions()` if you need runtime information.
- `draw()` runs on each render pass. Use `chart.getContext("indicator")`, `chart.getVisibleExtent()`, and helper getters such as `getZoomLevel()` to map data to pixels.
- `updateLabel(dataTime?)` is invoked after renders and when locales or themes change. Update label text/values here.
- `getModifier(visibleTimeRange)` lets you modify the Y-axis extent. Return an `ExtentModifier` when the indicator should influence automatic scaling (for example, Bollinger Bands).
- `updateOptions(partial)` merges new options, requests a redraw, and re-renders the label.

## Paneled indicators

`PaneledIndicator` extends `Indicator` and supplies its own container plus two canvases (main chart and Y axis). Implement the following methods:

```ts
abstract class MyPaneledIndicator extends PaneledIndicator<MyTheme, MyOptions> {
  public createExtent(): Extent { /* setup extent calculator */ }
  public draw(): void { /* draw using this.context */ }
  public updateLabel(): void { /* optional */ }
  public getCrosshairValue(time: number, relativeY: number): string {
    return "..."; // displayed next to the crosshair when hovering the panel
  }
}
```

- `init(params)` is handled by the chart and receives `{ width, height, x, y, devicePixelRatio }`.
- `resize(params)` is invoked whenever the parent chart resizes or the number of paneled indicators changes. Use it to recompute canvas sizes.
- `initDrawing()` clears the panel, paints the background, and draws shared grid lines. Call it at the start of `draw()`.
- `calculateYAxisLabels()` and `drawYAxis()` are helpers for rendering axis ticks using the indicator extent.

## Indicator events

The base class emits events when users interact with the label:

| Event                        | Description                               |
| ---------------------------- | ----------------------------------------- |
| `indicator-visibility-changed` | Fired after show/hide buttons are toggled. |
| `indicator-settings-open`    | Fired when the settings button is pressed.|
| `indicator-remove`           | Fired when the remove button is pressed.  |

Listen to these events via `chart.on(...)` to open modals, persist state, or synchronize UI.

## Example

```ts
import { MovingAverageIndicator } from "@ardinsys/financial-charts";

const sma = new MovingAverageIndicator({
  period: 20,
  source: "close"
});

chart.addIndicator(sma);
```

For more involved use cases inspect `src/indicators/simple/moving-average.ts` in the repository. It shows how to cache computed values, honour locales, and render on the shared indicator canvas.
