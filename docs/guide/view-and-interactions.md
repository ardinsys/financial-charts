# View and interactions

Control how the chart looks and behaves at runtime: zoom, pan, swap controllers, and respond to user input.

## Adjusting the core view

`updateCoreOptions(range, stepSize, maxZoom)` recalculates internal state, remaps data to the new `stepSize`, and triggers a redraw. Passing `"auto"` as the range keeps the window anchored to your data.

```ts
chart.updateCoreOptions("auto", 15 * 60 * 1000, 150);
```

When you need deterministic motion (custom zoom buttons, minimaps), read the current window and feed a modified range back into the chart:

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
- **Theme/locale:** call `updateTheme` or `updateLocale` whenever user preferences change.

## Controllers and indicators

- Switch renderers without losing zoom/pan via `chart.changeType("hlc-area")` (controller must be registered first).
- Add/remove overlay or paneled indicators dynamically: `chart.addIndicator(indicator)` / `chart.removeIndicator(indicator)`.
- The chart automatically allocates space for paneled indicators while keeping at least 25% of height for price.

## Events

Subscribe with `chart.on(event, handler)` – each call returns an unsubscribe function.

| Event                         | Payload                                         | When it fires                                 |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------- |
| `click`                       | `{ event: PointerEvent, point: Candle }`        | User clicks the chart with a mouse.           |
| `touch-click`                 | `{ event: TouchEvent, point: Candle }`          | User taps the chart on touch devices.         |
| `indicator-visibility-changed` | `{ indicator, visible }`                       | Indicator show/hide buttons are toggled.      |
| `indicator-settings-open`     | `{ indicator }`                                 | Settings button next to an indicator is used. |
| `indicator-remove`            | `{ indicator }`                                 | Indicator remove button is pressed.           |

Use these hooks to open dialogs, sync layout with other widgets, or log interactions.

## Resizing and disposal

- The chart observes its own container, so CSS-driven resizes trigger redraws automatically.
- Ensure the container is measurable when instantiating (avoid hidden tabs/accordions).
- Call `chart.dispose()` on unmount to remove observers, animation frames, and event listeners.
