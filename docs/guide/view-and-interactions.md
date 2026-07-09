# View and interactions

Control how the chart looks and behaves at runtime: zoom, pan, swap controllers, attach plugins, and respond to user input.

## Adjusting the core view

`updateCoreOptions(range, stepSize, maxZoom)` recalculates internal state, remaps data to the new `stepSize`, and triggers a redraw. Passing `"auto"` as the range keeps the window anchored to your data.

```ts
chart.updateCoreOptions("auto", 15 * 60 * 1000, 150);
```

When you need deterministic navigation, read the current window and feed a modified range back into the chart:

```ts
const current = chart.getVisibleTimeRange();
const moveBy = (current.end - current.start) * 0.25;

chart.updateCoreOptions(
  { start: current.start + moveBy, end: current.end + moveBy },
  chart.getOptions().stepSize,
  chart.getOptions().maxZoom
);
```

## Interactions

- **Zoom:** pinch or scroll – combine with programmatic zoom for fixed increments.
- **Pan:** click-drag or touch-drag.
- **Volume overlay:** toggle with `setVolumeDraw(true | false)`.
- **Theme/localization:** call `updateTheme` or `updateLocalization` whenever user preferences change.
- **Drawings:** attach `DrawingManager` and choose a drawing factory. See [Drawing tools](/guide/drawing-tools).
- **Synced crosshair:** call `setCrosshair({ time })` on peer charts and `clearCrosshair()` when the source pointer leaves.

## Controllers, indicators, and plugins

- Switch renderers without losing zoom/pan via `chart.changeType("hlc-area")` (controller must be registered first).
- Add/remove overlay or paneled indicators dynamically: `chart.addIndicator(indicator)` / `chart.removeIndicator(indicator)`.
- The chart automatically allocates space for paneled indicators while keeping at least 25% of height for price.
- Attach custom overlay behavior with `chart.addPlugin(plugin)`. Plugins can listen to data, visible-range, pointer, and render lifecycle hooks.

Render invalidation uses named layers:

```ts
chart.requestRedraw(["series", "indicators", "drawings"]);
```

Use `"controller"` when you want to redraw the grid, axes, and main series together.

Plugins that draw a comparison series above the active controller can register a
`series` render-stage hook and request `"series"` redraws when their secondary
dataset changes.

## Events

Subscribe with `chart.on(event, handler)` – each call returns an unsubscribe function.

| Event                          | Payload                                                   | When it fires                                 |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------- |
| `click`                        | `{ event: PointerEvent, point: ChartData }`               | User clicks the chart with a mouse.           |
| `touch-click`                  | `{ event: TouchEvent, point: ChartData }`                 | User taps the chart on touch devices.         |
| `indicator-visibility-changed` | `{ indicator, visible }`                                  | Indicator show/hide buttons are toggled.      |
| `indicator-settings-open`      | `{ indicator }`                                           | Settings button next to an indicator is used. |
| `indicator-remove`             | `{ indicator }`                                           | Indicator remove button is pressed.           |
| `drawing-create`               | `{ drawing }`                                             | Pointer-created drawing is finalized.         |
| `drawing-change`               | `{ drawing }`                                             | Drawing anchors or content change.            |
| `drawing-finished`             | `{ drawing, operation, id, type, paneId, anchors, json }` | Pointer create or drag operation completes.   |
| `drawing-select`               | `{ drawing?, id?, type?, paneId?, anchors?, json? }`      | Drawing selection changes or clears.          |
| `drawing-delete`               | `{ drawing }`                                             | Drawing is removed through `DrawingManager`.  |

Use these hooks to open dialogs, sync layout with other widgets, or log interactions. `ChartData` is exported by the library for strongly typed payloads.

## Resizing and disposal

- The chart observes its own container, so CSS-driven resizes trigger redraws automatically.
- Ensure the container is measurable when instantiating (avoid hidden tabs/accordions).
- Call `chart.dispose()` on unmount to remove observers, animation frames, and event listeners.
