# Indicators

Indicators can be drawn either on top of the main price chart (overlay indicators) or inside dedicated panes stacked underneath (paneled indicators). Indicators implement the `ChartPlugin` lifecycle, so attachment, data updates, redraws, pointer-aware crosshair updates, and cleanup all flow through the same plugin contract.

## Base indicator API

```ts
import {
  Indicator,
  type DefaultIndicatorOptions
} from "@ardinsys/financial-charts";

abstract class MyIndicator extends Indicator<MyTheme, MyOptions> {
  public getDefaultOptions(): MyOptions {
    /* ... */
  }
  public getDefaultThemes(): Record<string, MyTheme> {
    /* ... */
  }
  public draw(): void {
    /* render using chart contexts */
  }
  public updateLabel(dataTime?: number): void {
    /* sync label contents */
  }
}
```

### DefaultIndicatorOptions

Every indicator merges its supplied options with these defaults:

| Field           | Description                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `key`           | Unique identifier (for labels and debugging).                                                      |
| `names`         | Localized display names keyed by locale (`default` is used as a fallback).                         |
| `labelTemplate` | HTML template used for the indicator pill. Two versions are usually provided (`light` and `dark`). |
| `labelRenderer` | Optional renderer object for replacing the template rendering strategy.                            |

The base class automatically wires the template buttons:

- Show/hide toggles (`data-id="show"` / `"hide"`).
- Settings button (`indicator-settings-open` event).
- Remove button (`indicator-remove` event).

### Lifecycle hooks

- `attach(ctx)` is inherited from `Indicator` and calls `setChart(ctx.chart)`.
- `setChart(chart)` is called when the indicator is attached. Use it to cache the reference and read `chart.getOptions()` if you need runtime information.
- `draw()` runs on each indicator render pass. Use `chart.getContext("indicator")`, `chart.getTimeScale()`, and `chart.getPriceScale()` to map data to pixels.
- `updateLabel(dataTime?)` is invoked after renders and when locales or themes change. Update label text/values here.
- `getModifier(visibleTimeRange)` lets you modify the price range. Return a `ScaleRangeModifier` when the indicator should influence automatic scaling (for example, Bollinger Bands).
- `updateOptions(partial)` merges new options, requests a redraw, and re-renders the label.
- `detach()` is called when an indicator is removed or the chart is disposed; the base class uses it to remove label listeners.

### Label templates

Ensure your template includes these `data-id` hooks so the base class can wire events and localization:

- `label`, `name`, `extra`, `value`
- `show`, `hide`, `settings`, `remove`

Templates are chosen by `chart.getOptions().theme.key` (default `"light"` / `"dark"`). Provide matching entries for each theme key you support to avoid missing buttons.

## Paneled indicators

`PaneledIndicator` extends `Indicator` and supplies its own container plus two canvases (main pane and Y axis). The chart creates a `Pane` for each paneled indicator and passes it in `InitParams`. Implement the following methods:

```ts
abstract class MyPaneledIndicator extends PaneledIndicator<MyTheme, MyOptions> {
  public createExtent(): DataScaleModel {
    /* setup scale model */
  }
  public draw(): void {
    /* draw using this.context */
  }
  public updateLabel(): void {
    /* optional */
  }
  public getCrosshairValue(time: number, relativeY: number): string {
    return "..."; // displayed next to the crosshair when hovering the panel
  }
}
```

- `init(params)` is handled by the chart and receives `{ width, height, x, y, devicePixelRatio, pane }`.
- `resize(params)` is invoked whenever the parent chart resizes or the number of paneled indicators changes. Use it to recompute canvas sizes.
- `initDrawing()` clears the panel, paints the background, and draws shared grid lines. Call it at the start of `draw()`.
- `calculateYAxisLabels()` and `drawYAxis()` are helpers for rendering axis ticks through the pane's price scale.

## Indicator events

The base class emits events when users interact with the label:

| Event                          | Description                                |
| ------------------------------ | ------------------------------------------ |
| `indicator-visibility-changed` | Fired after show/hide buttons are toggled. |
| `indicator-settings-open`      | Fired when the settings button is pressed. |
| `indicator-remove`             | Fired when the remove button is pressed.   |

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
