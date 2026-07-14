# Scales

The v1 chart uses index-based X mapping. Each data point occupies one ordinal slot, so weekends, holidays, and missing bars do not create blank horizontal gaps.

Scale, pane, render-pipeline, tick, and low-level canvas contracts are exported
from `@ardinsys/financial-charts/engine` rather than the application-focused
root entry.

## Scale interface

```ts
type ScaleProjectOptions = {
  canvas: { width: number; height: number };
  devicePixelRatio?: number;
  barAlignment?: "center" | "edge";
};

interface Scale {
  project(value: number, options: ScaleProjectOptions): number;
  unproject(pixel: number, options: ScaleProjectOptions): number;
  getTicks(options: ScaleTickOptions): ScaleTick[];
}
```

`HTMLCanvasElement.width` and `.height` are physical backing-store pixels.
Scale projections return logical CSS-pixel coordinates: they divide the canvas
dimensions by `devicePixelRatio` (or the current display ratio when omitted).
Chart and extension contexts are already scaled, so draw projected coordinates
directly. Pass an explicit ratio when projecting against a canvas-like object
outside the chart.

```ts
const point = priceScale.project(125.5, {
  canvas: { width: 1600, height: 800 },
  devicePixelRatio: 2
});
// `point` is within a logical height of 400.
```

## TimeScale

`TimeScale` maps timestamps to visible index slots. It can also project raw indexes for drawing anchors and custom index-aware overlays.

| Method                           | Description                                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| `project(time, options)`         | Finds the nearest data index for a timestamp and returns the X coordinate. |
| `unproject(pixel, options)`      | Maps an X coordinate back to the nearest timestamp.                        |
| `projectIndex(index, options)`   | Projects an ordinal data index directly. Used by drawings.                 |
| `unprojectIndex(pixel, options)` | Converts an X coordinate back to a fractional index.                       |
| `setRange(range)` / `getRange()` | Updates or reads the visible index range.                                  |
| `setTimes(times)`                | Updates the timestamp lookup array.                                        |
| `setBarAlignment(alignment)`     | Sets default `"center"` or `"edge"` bar alignment.                         |

`TimeScaleRange` is `{ from, to, rightOffset? }` in index units. Range setters
snapshot their input. Range getters return the same frozen snapshot until the
next setter call, so reading a range during rendering does not allocate.

`times` must be sorted in ascending timestamp order. The scale treats the
readonly array as a stable lookup table; call `setTimes()` after replacing it.

## PriceScale

`PriceScale` maps numeric values to Y coordinates, where lower prices are lower on screen.

| Method                                           | Description                                   |
| ------------------------------------------------ | --------------------------------------------- |
| `project(value, options)`                        | Maps a price/value to a logical Y coordinate. |
| `unproject(pixel, options)`                      | Maps a Y coordinate back to a price/value.    |
| `projectVolume(value, options, maxHeightRatio?)` | Maps volume to a column height.               |
| `setRange({ min, max })` / `getRange()`          | Updates or reads the numeric range.           |

Price range setters and getters use the same immutable, allocation-free read
contract as `TimeScale`.

## DataScaleModel

Controllers use `DataScaleModel` to coordinate time, price, and volume scales for the active data set.

```ts
import { DataScaleModel } from "@ardinsys/financial-charts/engine";

const scale = new DataScaleModel("ohlc", data, visibleTimeRange);
const point = scale.mapToPixel(time, price, canvas);
const value = scale.pixelToPoint(x, y, canvas);
```

| Method                                                    | Description                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `recalculate(data, timeRange, timeOptions?)`              | Rebuilds min/max ranges from data and time options.                       |
| `addDataPoint(point)`                                     | Updates ranges for one streamed point. Returns whether the scale changed. |
| `mapToPixel(time, value, canvas)`                         | Projects a timestamp/value pair.                                          |
| `pixelToPoint(x, y, canvas)`                              | Unprojects a pixel point to timestamp/value.                              |
| `mapVolToPixel(time, volume, canvas)`                     | Projects volume into the volume scale.                                    |
| `getTimeScale()` / `getPriceScale()` / `getVolumeScale()` | Accesses underlying scales.                                               |
| `addModifier(modifier)` / `removeModifier(actor)`         | Lets indicators influence automatic Y range.                              |

Indicators usually do not need to instantiate scales for overlays. Use `getDrawingContext()` and its `projectTime`, `projectPrice`, and `projectPoint` helpers. Paneled indicators create a `DataScaleModel` when they need a dedicated Y range.

## Ticks

The built-in tick generators are exported for custom axes and tests:

- `calculateYAxisLabels()` and `calculateStepSize()` for price labels.
- `TimeTickGenerator` / `generateTimeTicks()` for index-aware time labels, including seconds and sub-minute ranges.

Time ticks consume public timestamp data rather than a chart-internal store:

```ts
import { generateTimeTicks } from "@ardinsys/financial-charts/engine";

const ticks = generateTimeTicks({
  times: data.map((point) => point.time),
  visibleRange: { from: 20, to: 80 },
  formatter,
  targetTickCount: 8
});
```

The timestamps must be sorted in ascending order. `visibleRange` uses indexes
into that array and may contain fractional bounds.
