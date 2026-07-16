# Plugins

Plugins are extension objects attached with `chart.addPlugin(plugin)`. They can render into chart layers, listen to data and pointer changes, emit chart events, and clean up in `detach()`.

Each attached plugin must have a unique `key`, and the same plugin instance
cannot be attached twice. `addPlugin()` returns an idempotent disposer. After
`attach()`, lifecycle hooks immediately receive current state in this order:
`onOptionsChanged()` with an empty `changedKeys`, `onData()`, then
`onVisibleRangeChanged()`. Plugins added after `setData()` do not need to poll
the chart.

```ts
import type {
  ChartContext,
  ChartPlugin
} from "@ardinsys/financial-charts/extensions";

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
| `onData(data)`                 | Current frozen data after attach and whenever `setData()`, `updateData()`, clearing, or `stepSize` remapping changes mapped data.  |
| `onVisibleRangeChanged(range)` | Current whole-bar range after attach and once after each effective programmatic, pan, zoom, resize, or core-options view change.  |
| `onOptionsChanged(event)`      | Optional notification containing previous/current resolved options and changed keys. Empty `changedKeys` means initial delivery.  |
| `onPointer(event)`             | Optional notification for pointer down/move/up events mapped to data and pane space. Return `true` to consume the pointer gesture. |
| `onDrawingFinished(event)`     | Optional notification when a drawing create or drag operation completes.                                                           |
| `detach()`                     | Optional cleanup hook called after the attachment signal is aborted and context subscriptions/annotations are removed.            |

Indicators use the same lifecycle hooks. Data, range, options, and drawing
notifications run through overlay indicators, paneled indicators, then ordinary
plugins in attachment order. A removed extension is skipped for the remainder
of the current notification. Pointer delivery follows visual stacking instead:
ordinary plugins, paneled indicators, then overlays, with each group visited in
reverse attachment order. Returning `true` stops delivery to lower extensions.

Indicators retain their dedicated indicator render pass; they are not also
drawn by the ordinary plugin pass.

## ChartContext

| Helper                            | Description                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `domAdapter`                      | Active `ChartDOMAdapter`, useful when plugins need app-owned DOM chrome.                                       |
| `hostElement`                     | The element passed to the chart constructor, for scoped keyboard or focus handling.                           |
| `signal`                          | Attachment-scoped `AbortSignal`, aborted before `detach()`, on failed attachment, and on chart disposal.      |
| `emit(event, data)`               | Emits a chart event.                                                                                           |
| `getData()`                       | Returns the chart's current stable mapped-data snapshot.                                                       |
| `getOptions()`                    | Returns the immutable resolved options snapshot.                                                              |
| `getCanvasContext(layer)`         | Returns a scaled 2D context for `main`, `indicator`, `drawings`, `crosshair`, `x-label`, or `y-label`.         |
| `getLogicalCanvas(layer)`         | Returns logical pixel size for the layer.                                                                      |
| `getPanes()`                      | Returns a readonly pane snapshot, including the main pane and paneled indicators.                             |
| `getPlugin(key)`                  | Returns the attached plugin with the matching unique `key`, useful for plugin-to-plugin integration.          |
| `getPlugins()`                    | Returns a readonly snapshot of currently attached plugins.                                                     |
| `getVisibleTimeWindow()`          | Returns the precise fractional visible timestamp window for pan/zoom replication.                              |
| `getVisibleTimeRange()`           | Returns the current visible timestamp range.                                                                   |
| `setVisibleTimeWindow(range)`     | Applies a precise fractional timestamp window.                                                                 |
| `getCrosshairState()`             | Returns the current resolved native crosshair state.                                                           |
| `on(event, listener)`             | Subscribes for the lifetime of this attachment and returns an early disposer.                                 |
| `onRenderStage(stage, callback)`  | Registers an attachment-scoped render-pipeline hook and returns an early disposer.                            |
| `requestRedraw(part, immediate?)` | Schedules one or more redraw parts.                                                                            |
| `setPriceAxisAnnotations(items)`  | Replaces this extension's price lines and Y-axis labels and schedules their layer.                            |
| `clearPriceAxisAnnotations()`     | Removes this extension's price-axis annotations.                                                               |
| `setCrosshair(options)`           | Sets the native crosshair from plugin code and returns the resolved state.                                     |
| `clearCrosshair()`                | Clears the native crosshair and pointer-aware indicator labels.                                                |
| `getIndicators()`                 | Returns every attached indicator as a readonly snapshot.                                                       |
| `getIndicatorById(instanceId)`    | Returns an attached indicator by its unique instance identity.                                                 |
| `addIndicator(indicator)`         | Attaches an indicator with normal chart lifecycle and event semantics.                                         |
| `removeIndicator(indicator)`      | Detaches an indicator with normal chart lifecycle and event semantics.                                         |
| `remove()`                        | Detaches the owning extension with normal chart removal semantics.                                             |

### Attachment-scoped cleanup

Use `signal` with APIs that accept `AbortSignal`, including `fetch()` and app
services. Event and render subscriptions created through `ctx.on()` and
`ctx.onRenderStage()` are removed automatically when the attachment ends. Keep
their returned disposer only when the extension needs to stop earlier.

```ts
attach(ctx: ChartContext) {
  ctx.on("crosshair-clear", () => this.clearHover());
  ctx.onRenderStage("indicators", () => this.drawMarkers());
  void this.load({ signal: ctx.signal });
}
```

The signal is aborted and owned annotations and scoped subscriptions are
removed before `detach()` runs. `detach()` therefore only needs to release
resources that are not signal-aware or registered through these helpers.
`ChartContext` does not expose the chart façade, so event and render
subscriptions cannot bypass attachment scoping.

## Render stages and redraw parts

Render stages run in this order:

`beforeDraw -> grid -> axes -> series -> indicators -> drawings -> annotations -> crosshair -> afterDraw`

Redraw parts are layer-oriented: `grid`, `axes`, `series`, `indicators`,
`drawings`, `annotations`, and `crosshair`.

Register a hook on `series` when a plugin should draw immediately above the
active controller but below indicators, drawings, annotations, and crosshair.
This is useful for comparison-series overlays that have their own data stream.

## Price-axis annotations

Extensions can contribute price lines and Y-axis labels without accessing or
clearing an axis canvas. The collection is owned by the attachment that submits
it, and each call replaces that attachment's previous collection:

```ts
attach(ctx) {
  ctx.setPriceAxisAnnotations([
    {
      id: "working-order-42",
      paneId: ctx.getPanes()[0].getId(),
      value: 124.5,
      text: "124.50",
      color: "#1565c0",
      labelColor: "#0d47a1",
      textColor: "#fff",
      lineDash: [4, 3],
      emphasized: hovered
    }
  ]);
}
```

`visible`, `line`, and `label` default to `true`. `text` defaults to the chart's
formatted price. Values outside their pane are hidden by default; set
`offscreen: "clamp"` to render at the nearest pane edge. Lines are clipped to
the plot region. When labels overlap, emphasized labels win, then provider and
array order; colliding lower-priority labels are omitted while their lines
remain visible. Missing pane IDs are ignored. Annotation colors, typography,
line widths, dashes, and label dimensions can be set through
`theme.priceAxisAnnotation`, with per-item overrides where supported.

Use `line: "axis"` for an axis-only boundary. The optional `range` and
`labelStyle` fields support axis range fills and specialized badge treatment;
`collision: "allow"` is available for providers that must retain every label.

Calling `clearPriceAxisAnnotations()` or submitting an empty array removes the
collection. Detaching the extension removes it automatically. The owned canvas
renders above drawings and below the crosshair.

Annotation IDs must be non-empty and unique within one submitted collection.
Values and optional range targets must be finite, pane IDs must be non-negative
integers, line widths must be positive, and dash values must be finite and
non-negative. The chart snapshots the model, so later mutation of the caller's
array does not change rendered annotations.

## Built-in plugins

### ChartSyncPlugin

`ChartSyncPlugin` links chart instances by `group` and synchronizes visible time
range, crosshair, drawings, drawing selection, and indicators. Add one plugin
instance to each chart that should participate:

```ts
import {
  ChartSyncPlugin,
  DrawingManager,
  FinancialChart,
  MovingAverageIndicator
} from "@ardinsys/financial-charts";
import { OrdersIndicator } from "./orders-indicator";

const drawingManager = new DrawingManager();
const indicatorResolver = ({ typeId }) => {
  switch (typeId) {
    case MovingAverageIndicator.ID:
      return new MovingAverageIndicator();
    case OrdersIndicator.ID:
      return new OrdersIndicator(orderService);
    default:
      return undefined;
  }
};

chart.addPlugin(drawingManager);
chart.addPlugin(
  new ChartSyncPlugin({
    group: "watchlist",
    drawingManager,
    indicatorResolver
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
  indicatorResolver,
  messages: true
});
```

Crosshair and visible range sync are time-based, so charts can have different
data spans or tick sizes. Indicator synchronization uses the same JSON-safe
`IndicatorState` and application-owned resolver as chart restoration. Supply
`indicatorResolver` whenever `indicators` is enabled and indicators may be
present; set `indicators: false` when a sync group should not synchronize them.
The resolver constructs custom indicators with their runtime dependencies,
while stored sync-group state contains only serializable configuration.
Freshly mounted charts also perform their initial sync after their first
`setData()` if the sync plugin was attached before data was available. The group
keeps the latest state as detached snapshots, so virtualized rows can all
unmount briefly and the next mounted chart can still rehydrate without holding
old chart or DOM instances alive.
Received indicator mutations publish the same chart events as local mutations;
the plugin's application guard prevents those events from being rebroadcast.

Third-party plugins can also use the sync group as a small message bus. Add the
sync plugin before plugins that read it from `attach()`, then use
`postMessage()` and `onMessage()` with an app-owned channel name:

```ts
import { ChartSyncPlugin } from "@ardinsys/financial-charts";
import type { ChartPlugin } from "@ardinsys/financial-charts/extensions";

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
`message.source.plugin` identifies the sending `ChartSyncPlugin`, and
`message.source.group` identifies its group. Custom messages are runtime-only
and are not part of `initialSync`.

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
When it attaches after a `DrawingManager`, it immediately receives the
manager's current selection. It also tracks selection clearing while the
manager is detached and the retained selection when that manager is attached
again.
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

Y-axis bounds are contributed through the shared price-axis annotation layer,
so they can coexist with order, position, and alert labels without clearing the
axis canvas. X-axis bounds remain in the axis render stage.

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
