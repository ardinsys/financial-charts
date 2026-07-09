# Plugins

Plugins are extension objects attached with `chart.addPlugin(plugin)`. They can render into chart layers, listen to data and pointer changes, emit chart events, and clean up in `detach()`.

```ts
import type { ChartContext, ChartPlugin } from "@ardinsys/financial-charts";

class WatermarkPlugin implements ChartPlugin {
  readonly key = "watermark";
  private ctx!: ChartContext;

  attach(ctx: ChartContext): void {
    this.ctx = ctx;
  }

  afterDraw(): void {
    const ctx = this.ctx.getCanvasContext("crosshair");
    const size = this.ctx.getLogicalCanvas("crosshair");

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.font = "700 48px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("AAPL", size.width / 2, size.height / 2);
    ctx.restore();
  }
}

chart.addPlugin(new WatermarkPlugin());
```

## ChartPlugin

| Member                         | Description                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| `key`                          | Stable plugin id for debugging and application bookkeeping.                          |
| `attach(ctx)`                  | Called once when the plugin is added. Store the context here.                        |
| `beforeDraw()`                 | Optional draw hook before the render pipeline starts.                                |
| `draw()`                       | Optional draw hook on the plugin draw pass.                                          |
| `afterDraw()`                  | Optional draw hook after the render pipeline finishes.                               |
| `onData(data)`                 | Optional notification after `draw()` or `drawNextPoint()` changes chart data.        |
| `onVisibleRangeChanged(range)` | Optional notification when pan/zoom changes the visible time range.                  |
| `onPointer(event)`             | Optional notification for pointer down/move/up events mapped to data and pane space. |
| `detach()`                     | Optional cleanup hook called by `removePlugin()` or chart disposal.                  |

## ChartContext

| Helper                            | Description                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `chart`                           | The `FinancialChart` instance. Prefer context helpers for extension work when available.                       |
| `domAdapter`                      | Active `ChartDOMAdapter`, useful when plugins need app-owned DOM chrome.                                       |
| `emit(event, data)`               | Emits a chart event.                                                                                           |
| `getCanvasContext(layer)`         | Returns a scaled 2D context for `main`, `grid`, `indicator`, `drawings`, `crosshair`, `x-label`, or `y-label`. |
| `getLogicalCanvas(layer)`         | Returns logical pixel size for the layer.                                                                      |
| `getPanes()`                      | Returns pane models, including the main pane and paneled indicators.                                           |
| `getVisibleTimeRange()`           | Returns the current visible timestamp range.                                                                   |
| `on(event, listener)`             | Subscribes to chart events and returns an unsubscribe function.                                                |
| `onRenderStage(stage, callback)`  | Registers a render-pipeline hook.                                                                              |
| `requestRedraw(part, immediate?)` | Schedules one or more redraw parts.                                                                            |

## Render stages and redraw parts

Render stages run in this order:

`beforeDraw -> grid -> axes -> series -> indicators -> drawings -> crosshair -> afterDraw`

Redraw parts are layer-oriented: `grid`, `axes`, `series`, `indicators`, `drawings`, `crosshair`, and the compatibility alias `controller` for `grid` + `axes` + `series`.

## Pointer events

`onPointer(event)` receives data-aware pointer payloads:

```ts
type ChartPointerEvent = {
  type: "down" | "move" | "up";
  x: number;
  y: number;
  time: number;
  pane: Pane;
  dataPoint: ChartData;
};
```

The `pane` tells plugins whether the pointer is over the main chart or a paneled indicator. Use `pane.getRegion()` and `pane.getRelativeY(event.y)` for pane-local work.
