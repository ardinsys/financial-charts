# Plugins

Plugins are extension objects attached with `chart.addPlugin(plugin)`. They can render into chart layers, listen to data and pointer changes, emit chart events, and clean up in `detach()`.

Each attached plugin must have a unique `key`, and the same plugin instance
cannot be attached twice. `addPlugin()` returns an idempotent disposer.

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

| Member                         | Description                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `key`                          | Stable plugin id for debugging and application bookkeeping.                                                                        |
| `attach(ctx)`                  | Called once when the plugin is added. Store the context here.                                                                      |
| `beforeDraw()`                 | Optional draw hook before the render pipeline starts.                                                                              |
| `draw()`                       | Optional draw hook on the plugin draw pass.                                                                                        |
| `afterDraw()`                  | Optional draw hook after the render pipeline finishes.                                                                             |
| `onData(data)`                 | Optional notification after `setData()` or `updateData()` changes chart data.                                                       |
| `onVisibleRangeChanged(range)` | Optional notification when pan/zoom changes the visible time range.                                                                |
| `onPointer(event)`             | Optional notification for pointer down/move/up events mapped to data and pane space. Return `true` to consume the pointer gesture. |
| `onDrawingFinished(event)`     | Optional notification when a drawing create or drag operation completes.                                                           |
| `detach()`                     | Optional cleanup hook called by `removePlugin()` or chart disposal.                                                                |

## ChartContext

| Helper                            | Description                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `chart`                           | The `FinancialChart` instance. Prefer context helpers for extension work when available.                       |
| `domAdapter`                      | Active `ChartDOMAdapter`, useful when plugins need app-owned DOM chrome.                                       |
| `emit(event, data)`               | Emits a chart event.                                                                                           |
| `getCanvasContext(layer)`         | Returns a scaled 2D context for `main`, `grid`, `indicator`, `drawings`, `crosshair`, `x-label`, or `y-label`. |
| `getLogicalCanvas(layer)`         | Returns logical pixel size for the layer.                                                                      |
| `getPanes()`                      | Returns a readonly pane snapshot, including the main pane and paneled indicators.                             |
| `getPlugin(key)`                  | Returns the attached plugin with the matching unique `key`, useful for plugin-to-plugin integration.          |
| `getPlugins()`                    | Returns a readonly snapshot of currently attached plugins.                                                     |
| `getVisibleTimeWindow()`          | Returns the precise fractional visible timestamp window for pan/zoom replication.                              |
| `getVisibleTimeRange()`           | Returns the current visible timestamp range.                                                                   |
| `on(event, listener)`             | Subscribes to chart events and returns an unsubscribe function.                                                |
| `onRenderStage(stage, callback)`  | Registers a render-pipeline hook.                                                                              |
| `requestRedraw(part, immediate?)` | Schedules one or more redraw parts.                                                                            |
| `setCrosshair(options)`           | Sets the native crosshair from plugin code and returns the resolved state.                                     |
| `clearCrosshair()`                | Clears the native crosshair and pointer-aware indicator labels.                                                |

## Render stages and redraw parts

Render stages run in this order:

`beforeDraw -> grid -> axes -> series -> indicators -> drawings -> crosshair -> afterDraw`

Redraw parts are layer-oriented: `grid`, `axes`, `series`, `indicators`, `drawings`, `crosshair`, and the compatibility alias `controller` for `grid` + `axes` + `series`.

Register a hook on `series` when a plugin should draw immediately above the
active controller but below indicators, drawings, and crosshair. This is useful
for comparison-series overlays that have their own data stream.

## Built-in plugins

### ChartSyncPlugin

`ChartSyncPlugin` links chart instances by `group` and synchronizes visible time
range, crosshair, drawings, drawing selection, and indicators. Add one plugin
instance to each chart that should participate:

```ts
import {
  ChartSyncPlugin,
  DrawingManager,
  FinancialChart
} from "@ardinsys/financial-charts";

const drawingManager = new DrawingManager();
chart.addPlugin(drawingManager);
chart.addPlugin(
  new ChartSyncPlugin({
    group: "watchlist",
    drawingManager
  })
);
```

Defaults enable all sync channels:

```ts
new ChartSyncPlugin({
  group: "watchlist",
  visibleRange: true,
  crosshair: true,
  drawings: true,
  indicators: true,
  messages: true
});
```

Crosshair and visible range sync are time-based, so charts can have different
data spans or tick sizes. Indicators are cloned through `indicator.clone()`, so
custom indicators can participate without plugin-side registration. The base
indicator clone handles the standard `(themes, options)` constructor shape;
override `clone()` when an indicator owns additional constructor state.
Freshly mounted charts also perform their initial sync after their first
`draw()` if the sync plugin was attached before data was available. The group
keeps the latest state as detached snapshots, so virtualized rows can all
unmount briefly and the next mounted chart can still rehydrate without holding
old chart or DOM instances alive.

```ts
class MyIndicator extends Indicator<MyTheme, MyOptions> {
  constructor(
    private readonly feed: PriceFeed,
    options?: Partial<MyOptions>
  ) {
    super(null, options);
  }

  clone() {
    return new MyIndicator(this.feed, this.getOptions());
  }
}
```

Third-party plugins can also use the sync group as a small message bus. Add the
sync plugin before plugins that read it from `attach()`, then use
`postMessage()` and `onMessage()` with an app-owned channel name:

```ts
import { ChartSyncPlugin, type ChartPlugin } from "@ardinsys/financial-charts";

const sync = new ChartSyncPlugin({ group: "watchlist" });
chart.addPlugin(sync);
chart.addPlugin(new CompareSeriesPlugin());

class CompareSeriesPlugin implements ChartPlugin {
  readonly key = "compare-series";
  private sync?: ChartSyncPlugin;
  private unsubscribe?: () => void;

  attach(ctx) {
    this.sync = ctx.getPlugin<ChartSyncPlugin>("chart-sync");
    this.unsubscribe = this.sync?.onMessage<{
      symbol: string;
      color: string;
    }>("compare-series:update", ({ payload }) => {
      this.applyComparison(payload.symbol, payload.color);
    });
  }

  setComparison(symbol: string, color: string) {
    this.applyComparison(symbol, color);
    this.sync?.postMessage("compare-series:update", { symbol, color });
  }

  private applyComparison(symbol: string, color: string) {
    // Update this chart's overlay data and styles.
  }

  detach() {
    this.unsubscribe?.();
  }
}
```

Messages are delivered to peer charts in the same group. Pass
`{ includeSelf: true }` to also invoke local handlers. Handlers invoked from a
synced message are guarded against accidental rebroadcast, so a plugin does not
create an echo loop by calling `postMessage()` from inside its receive handler.
Custom messages are runtime-only and are not part of `initialSync`.

### DrawingSelectionPlugin

`DrawingSelectionPlugin` is a headless helper for app-owned selection UI. It
listens to drawing selection events and invokes your callback with the selected
drawing and the full selection event. It does not render DOM or mutate drawing
styles.

```ts
import {
  DrawingSelectionPlugin,
  type Drawing
} from "@ardinsys/financial-charts";

chart.addPlugin(
  new DrawingSelectionPlugin((drawing: Drawing | undefined) => {
    showDrawingToolbar(drawing);
  })
);
```

The default callback is a no-op, so `new DrawingSelectionPlugin()` is valid.
You can also pass an options object:

```ts
chart.addPlugin(
  new DrawingSelectionPlugin({
    onSelect: (drawing, event) => {
      updateDrawingToolbar({ drawing, id: event.id, anchors: event.anchors });
    }
  })
);
```

### DrawingAxisBoundsPlugin

`DrawingAxisBoundsPlugin` highlights the selected drawing's start/end values on
the X and Y axes. It works with `DrawingManager` events and is optional:

```ts
import {
  DrawingAxisBoundsPlugin,
  DrawingManager
} from "@ardinsys/financial-charts";

chart.addPlugin(new DrawingManager());
chart.addPlugin(new DrawingAxisBoundsPlugin());
```

It has defaults for labels, formatting, colors, and drawing types. Text drawings
are blacklisted by default because their axis bounds tend to add noise; pass
`blacklist: []` to enable every drawing type, or provide drawing type ids to
hide specific tools.

Date text uses the active chart formatter (`formatter.formatTooltipDate()`), so
`locale`, `timeZone`, and custom formatter options are respected automatically.
Price text uses `formatter.formatPrice()`.

Plugin-owned labels can be localized without adding anything to global
`localeValues`:

```ts
chart.addPlugin(
  new DrawingAxisBoundsPlugin({
    labels: {
      "en-US": { start: "S", end: "E" },
      "hu-HU": { start: "K", end: "V" },
      "*": { start: "S", end: "E" }
    }
  })
);
```

Colors and sizing default from `theme.drawingAxisBounds`, and can also be
overridden per plugin instance:

```ts
const theme = mergeThemes(defaultDarkTheme, {
  drawingAxisBounds: {
    strokeColor: "rgba(234, 179, 8, 0.9)",
    labelBackgroundColor: "#3A2E0F",
    rangeBackgroundColor: "rgba(234, 179, 8, 0.18)",
    textColor: "#FDE68A"
  }
});

chart.addPlugin(
  new DrawingAxisBoundsPlugin({
    blacklist: ["text"],
    showXAxis: true,
    showYAxis: true,
    showRange: true,
    formatText: ({ label, value }) => (label ? `${label} ${value}` : value)
  })
);
```

Custom drawings can control the values shown by overriding
`getAxisBounds(context)`. Return `x` anchors, `y` anchors, or both; duplicate
axis values are collapsed automatically so single-line tools can expose only the
meaningful axis.

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
  button?: number;
  buttons?: number;
};
```

The `pane` tells plugins whether the pointer is over the main chart or a paneled indicator. Use `pane.getRegion()` and `pane.getRelativeY(event.y)` for pane-local work.
