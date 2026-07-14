# View and interactions

Control how the chart looks and behaves at runtime: zoom, pan, swap controllers, attach plugins, and respond to user input.

## Update runtime options

`updateOptions()` applies runtime configuration changes atomically. Changing
`stepSize` remaps the original data and resets the visible range. Passing
`"auto"` as `timeRange` derives the configured range from the data.

```ts
chart.updateOptions({
  timeRange: "auto",
  stepSize: 15 * 60 * 1000,
  maxZoom: 150
});
```

The runtime patch accepts `type`, `timeRange`, `stepSize`, `maxZoom`, `volume`,
`theme`, `locale`, `timeZone`, `formatter`, and `localeValues`. The initial
`controllers`, `includeDefaultControllers`, and `domAdapter` are constructor
options. Use `registerController()` to add a controller class after
construction; the DOM adapter cannot be replaced.

The complete patch is validated before state changes. One effective patch emits
one `options-change` event with frozen `previous` and `current` snapshots plus
the ordered `changedKeys`. A patch with no effective change emits nothing and
does not redraw.

Option effects are deliberately narrow:

- `stepSize` remaps the original dataset and resets zoom and pan.
- `timeRange` resets zoom and pan without remapping data.
- `type` rebuilds the active scale while preserving the visible window.
- `theme`, localization, and volume redraw only affected layers.
- `maxZoom` changes the next zoom clamp; it does not alter the current view.

`getOptions()` returns the current immutable snapshot. A successful option
change replaces the snapshot rather than mutating the previous one.

## Set the visible range

When you need deterministic navigation, read the current window and feed a modified range back into the chart:

```ts
const current = chart.getVisibleTimeRange();
const moveBy = (current.end - current.start) * 0.25;

chart.setVisibleTimeRange({
  start: current.start + moveBy,
  end: current.end + moveBy
});
```

Choose the representation based on the required precision:

| API | Meaning | Typical use |
| --- | --- | --- |
| `getVisibleLogicalRange()` / `setVisibleIndexRange()` | Fractional ordinal bar indexes, including right offset. | Chart-native persistence and index-aware navigation. |
| `getVisibleTimeWindow()` / `setVisibleTimeWindow()` | Interpolated timestamps that preserve fractional indexes. | Lossless synchronization between charts. |
| `getVisibleTimeRange()` / `setVisibleTimeRange()` | Whole selected bars as `[start, end)`. | Date controls and application UI. |

All setters clamp to the configured index bounds with a minimum one-bar span,
then synchronously rescale, notify extensions once, and redraw dependent layers.
Applying the effective current range does nothing. Setters are no-ops before
data is loaded; after data is loaded, non-finite boundaries throw `RangeError`.

## Interactions

- **Zoom:** pinch or scroll; `maxZoom` controls the minimum visible span.
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

Request `"grid"`, `"axes"`, and `"series"` together when all controller-owned
layers need to be redrawn.

Plugins that draw a comparison series above the active controller can register a
`series` render-stage hook and request `"series"` redraws when their secondary
dataset changes.

## Events

Subscribe with `chart.on(event, handler)`; each call returns an unsubscribe
function.

| Event                          | Payload                                                   | When it fires                                 |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------- |
| `click`                        | `{ event: PointerEvent, point: ChartData }`               | User clicks the chart with a mouse.           |
| `touch-click`                  | `{ event: TouchEvent, point: ChartData }`                 | User taps the chart on touch devices.         |
| `crosshair-change`             | `{ time, y, pane, dataPoint }`                            | Native or programmatic crosshair moves.       |
| `crosshair-clear`              | `{}`                                                      | Native or programmatic crosshair clears.      |
| `options-change`               | `{ previous, current, changedKeys }`                      | An effective runtime option patch is applied. |
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
- Call `chart.dispose()` before removing the host. It aborts extension scopes,
  detaches indicators and plugins, removes listeners and observers, destroys
  chart-owned DOM, and can safely be called more than once.
