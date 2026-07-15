# Engine

The `@ardinsys/financial-charts/engine` entry point contains the lower-level
contracts for custom series controllers, panes, scales, render stages, ticks,
and canvas layers. Use `@ardinsys/financial-charts/extensions` for indicators,
plugins, drawings, and DOM adapter implementations.

Application code usually imports `FinancialChart` from the root package. For a
controller-curated bundle, import it from `./core`, set
`includeDefaultControllers: false`, and supply only the controller classes the
application uses.

## Custom controllers

A controller owns the main series' data scale, time bucketing, crosshair fields,
bar alignment, and drawing pass.

```ts
import { FinancialChart } from "@ardinsys/financial-charts/core";
import {
  ChartController,
  DataScaleModel,
  type BarAlignment,
  type ChartData,
  type ChartDataValueKey,
  type TimeRange
} from "@ardinsys/financial-charts/engine";

class CloseController extends ChartController {
  static readonly ID = "close";

  createDataScale(
    data: readonly ChartData[],
    timeRange: TimeRange
  ): DataScaleModel {
    return new DataScaleModel("simple", data, timeRange, {
      barAlignment: this.getBarAlignment()
    });
  }

  getCrosshairValues(): readonly ChartDataValueKey[] {
    return ["close", "volume"];
  }

  getBarAlignment(): BarAlignment {
    return "center";
  }

  getTimeFromRawDataPoint(point: ChartData): number {
    return (
      Math.round(point.time / this.options.stepSize) * this.options.stepSize
    );
  }

  draw(): void {
    const {
      canvasContext,
      visibleData,
      projectTime,
      projectPrice
    } = this.context.getDrawingContext();
    let started = false;

    canvasContext.beginPath();
    for (const point of visibleData) {
      if (point.close == null) continue;

      const x = projectTime(point.time);
      const y = projectPrice(point.close);
      if (started) canvasContext.lineTo(x, y);
      else {
        canvasContext.moveTo(x, y);
        started = true;
      }
    }
    canvasContext.stroke();
  }
}

const chart = new FinancialChart(container, {
  type: CloseController.ID,
  controllers: [CloseController],
  includeDefaultControllers: false,
  stepSize: 60_000
});
```

### Controller contracts

| Member                             | Contract                                                                                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `static ID`                        | Stable value used by `ChartOptions.type`.                                                                                    |
| `createDataScale(data, timeRange)` | Creates the scale model for the series. Use `"simple"` for close-only ranges and `"ohlc"` for high/low ranges.               |
| `getCrosshairValues()`             | Returns named `ChartData` value keys in the order they should appear. Volume is still omitted when chart volume is disabled. |
| `getBarAlignment()`                | Returns `"center"` for point/line series or `"edge"` when a bar body begins at its timestamp.                                |
| `getTimeAnchorAlignment()`         | Optionally gives drawings and X-axis anchors an alignment different from bar bodies. Defaults to `"center"`.                 |
| `getTimeFromRawDataPoint(point)`   | Maps a raw timestamp to the controller's bucket timestamp.                                                                   |
| `draw()`                           | Draws the series into the main context. Chart contexts use logical coordinates.                                              |

Controllers receive a `ChartControllerContext`, not the chart instance.
`getDrawingContext()` returns the current canvas, logical size, visible-data
snapshot, time range, pixels per bar, and time/price projection functions. This
is the complete controller capability set. It deliberately cannot mutate chart
scales, load data, change options, attach extensions, publish events, or dispose
the chart.

`drawingContext.visibleData` is a precomputed, readonly render input. The same
cached array is returned throughout a render instead of rebuilding or copying
the visible slice for every controller.

## Panes

`Pane` groups a logical plot region, Y-axis region, price scale, optional shared
time scale, and z-ordered drawables. Region coordinates are chart-local logical
pixels. `containsY()` accepts a chart-local Y coordinate, while
`getRelativeY()` converts it to pane-local space.

`setRegion()` and `setYAxisRegion()` snapshot their input. Their getters return
stable frozen objects until the next update, making repeated layout reads safe
and allocation-free. `getDrawables()` likewise caches its frozen z-ordered view
until a drawable is added or removed, so `draw()` does not sort and copy on each
render.

## Render pipeline

`RenderPipeline` runs callbacks in this fixed order:

`beforeDraw → grid → axes → series → indicators → drawings → annotations → crosshair → afterDraw`

`render(layers)` runs only requested layer stages, surrounded by `beforeDraw`
and `afterDraw`. An empty request runs nothing. `addHook(stage, callback)`
returns a disposer; call it when the hook's owner is released. Plugin and
indicator code should normally use attachment-scoped
`ChartContext.onRenderStage()` instead of owning a pipeline subscription.

## Canvas helpers and coordinate units

Canvas CSS dimensions and drawing commands use logical pixels. Canvas `width`
and `height` properties use physical backing pixels.

- `createCanvasLayer()` creates an absolutely positioned chart-style canvas.
- `resizeCanvasLayer(canvas, options)` sets CSS bounds and physical backing
  dimensions from logical width, height, and pixel ratio. Pass its context to
  have it scaled in the same operation.
- `scaleCanvasContext(context, ratio?)` configures logical drawing coordinates.
- `pixelRatio()` returns the current device ratio rounded to three decimals.
- `ChartContext.getLogicalCanvas(layer)` returns logical dimensions for a
  chart-owned layer to an attached extension.

Do not scale a chart-owned context again. It is already configured when returned
by `ChartContext.getCanvasContext()`.

## Palette selection

`paletteColor(colors, index)` deterministically cycles through a non-empty
readonly palette. It rejects an empty palette, negative indexes, and fractional
indexes. Pass the palette explicitly; the utility does not depend on a chart or
theme instance.
