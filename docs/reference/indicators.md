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
    const { ctx, data, projectPoint } = this.getDrawingContext();
    /* render using ctx + projection helpers */
  }
  protected getLabelContent(dataTime?: number): IndicatorLabelContent {
    /* return detail/value segments for the label */
  }
}
```

### DefaultIndicatorOptions

Every indicator merges its supplied options with these defaults:

| Field   | Description                                                                |
| ------- | -------------------------------------------------------------------------- |
| `key`   | Unique identifier (for labels and debugging).                              |
| `names` | Localized display names keyed by locale (`default` is used as a fallback). |

The base class builds an `IndicatorLabelModel` from these options, the current label content, visibility, and localized action titles. The chart hands that model to the active `ChartDOMAdapter`.

The default adapter renders and wires:

- Show/hide toggles (`data-id="show"` / `"hide"`).
- Settings button (`indicator-settings-open` event).
- Remove button (`indicator-remove` event).

### Lifecycle hooks

- `attach(ctx)` is inherited from `Indicator` and calls `setChart(ctx.chart)`.
- `setChart(chart)` is called when the indicator is attached. Use it to cache the reference and read `chart.getOptions()` if you need runtime information.
- `draw()` runs on each indicator render pass. Call `getDrawingContext()` to access the indicator canvas, data, visible data, visible range, scales, formatter/theme, and `projectTime` / `projectPrice` / `projectPoint` helpers without wiring canvas or scale plumbing yourself.
- `getLabelContent(dataTime?)` is invoked after renders and when locales or themes change. Return label detail text and optional value segments here; the base class updates the adapter-rendered label.
- `getModifier(visibleTimeRange)` lets you modify the price range. Return a `ScaleRangeModifier` when the indicator should influence automatic scaling (for example, Bollinger Bands).
- `updateOptions(partial)` merges new options, requests a redraw, and re-renders the label.
- `detach()` is called when an indicator is removed or the chart is disposed; the base class uses it to remove label listeners.

### Label model and DOM adapter

Indicators do not author DOM. Return label content from `getLabelContent()` and let the adapter render it:

```ts
protected getLabelContent(dataTime?: number): IndicatorLabelContent {
  return {
    detail: "20 close",
    segments: dataTime
      ? [{ text: this.chart.getFormatter().formatPrice(12.34), color: "#2962FF" }]
      : []
  };
}
```

`DefaultDOMAdapter` renders the model with stable `fci-*` CSS classes and `data-id` hooks. Pass a custom `domAdapter` in `ChartOptions` to render labels/actions through app-owned DOM or framework components. See [Design-system adapter](/guide/design-system-adapter).

## Paneled indicators

`PaneledIndicator` extends `Indicator` and supplies its own container plus two canvases (main pane and Y axis). The chart creates a `Pane` for each paneled indicator and passes it in `InitParams`. Implement the following methods:

```ts
abstract class MyPaneledIndicator extends PaneledIndicator<MyTheme, MyOptions> {
  public createScale(): DataScaleModel {
    /* setup scale model */
  }
  protected drawPane(ctx: PaneledIndicatorDrawingContext): void {
    /* draw only pane content; background/grid/Y axis are handled by the base */
  }
  protected getLabelContent(): IndicatorLabelContent {
    /* return detail/value segments for the label */
  }
  public getCrosshairValue(time: number, relativeY: number): string {
    return "..."; // displayed next to the crosshair when hovering the panel
  }
}
```

- `init(params)` and `resize(params)` are handled by the chart.
- `draw()` is implemented by the base class. It clears the panel, paints the background, draws shared grid lines, syncs the pane price scale, draws the Y axis, and then calls `drawPane(context)` when the indicator is visible.
- `drawPane(context)` receives the pane canvas context, axis context, pane, scale, price scale, dimensions, data, visible data, visible range, formatter/theme, and projection helpers.
- Existing paneled indicators that override `draw()` still work; new indicators should prefer `drawPane(context)` to avoid canvas/axis boilerplate.

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

const sma = new MovingAverageIndicator(null, {
  period: 20,
  source: "close"
});

chart.addIndicator(sma);
```

For more involved use cases, see [Custom indicators](/guide/custom-indicators) or inspect `src/indicators/simple/moving-average.ts` in the repository. It shows how to cache computed values, honor locales, and render on the shared indicator canvas.
