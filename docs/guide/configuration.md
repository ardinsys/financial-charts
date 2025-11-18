# Configuration

Fine tune the chart runtime by updating the core options, reacting to user events, and managing indicators at runtime.

## Core options

Call `updateCoreOptions` to replace the visible time range, step size, and maximum zoom. The chart resets internal state, remaps data to the new step size, and triggers a redraw.

```ts
chart.updateCoreOptions(
  {
    start: Date.UTC(2024, 0, 2),
    end: Date.UTC(2024, 0, 6)
  },
  30 * 60 * 1000,
  120
);
```

Changing the step size clears the derived data cache because the library maps each incoming candle to the correct slot automatically. If you keep `timeRange` fixed, the current zoom/pan is reset so the new data can be displayed consistently.

### Auto range

Pass `"auto"` as the first argument to let the chart compute the visible range from your data. This is useful when the feed is pre-trimmed to the desired window.

```ts
chart.updateCoreOptions("auto", 15 * 60 * 1000, 150);
```

When the range is `"auto"`, `drawNextPoint` expands the window as data arrives while keeping the user’s zoom level where possible. If the viewport is scrolled all the way to the right, the new candle snaps into view automatically.

### Programmatic zoom and pan

Fetch the current visible window with `getVisibleTimeRange()`, manipulate it, then feed it back into `updateCoreOptions`.

```ts
const current = chart.getVisibleTimeRange();
const duration = current.end - current.start;
const moveBy = duration * 0.25; // pan by 25%

chart.updateCoreOptions(
  {
    start: current.start + moveBy,
    end: current.end + moveBy
  },
  chart.getOptions().stepSize,
  chart.getOptions().maxZoom
);
```

This makes it easy to build custom zoom buttons, minimaps, or to persist layout between sessions.

## Interactions

- **Zooming:** Pinch or scroll to zoom. Combine with custom controls calling `updateCoreOptions` for deterministic increments.
- **Panning:** Drag the chart to move in time. The emitted events (see below) let you update other UI in response.
- **Volume overlay:** `setVolumeDraw(true/false)` toggles the histogram below the main chart without affecting other state.
- **Theme/locale:** Call `updateTheme` or `updateLocale` whenever the user toggles their preferences. Both methods merge their inputs into the existing configuration so you can update incrementally.

## Switching controllers

Switch the active controller without recreating the chart. Internal state such as pan and zoom is preserved.

```ts
chart.changeType("hlc-area");
```

If the requested controller was not registered beforehand, the chart throws so you can catch configuration mistakes early during development.

## Indicator management

Add overlay indicators (drawn on top of price data) or paneled indicators (separate canvas with its own Y axis).

```ts
import { MovingAverageIndicator } from "@ardinsys/financial-charts";

const sma = new MovingAverageIndicator();
chart.addIndicator(sma);

// ...

chart.removeIndicator(sma);
```

- Overlay indicators share the primary canvas and grid.
- Paneled indicators extend `PaneledIndicator` and receive their own container appended under the chart. The chart automatically redistributes height so that the price chart keeps at least 25 % of the vertical space.

## Toggling volume

Enable or disable the volume series dynamically with `setVolumeDraw`.

```ts
chart.setVolumeDraw(true);
```

## Updating the locale

Provide locale strings during instantiation or with `updateLocale`. Combine with custom formatter implementations for full control over labels.

```ts
chart.updateLocale("EN", {
  EN: {
    common: {
      sources: {
        open: "Open price",
        high: "High",
        low: "Low",
        close: "Close",
        volume: "Volume"
      }
    },
    indicators: {
      actions: {
        show: "Show",
        hide: "Hide",
        settings: "Settings",
        remove: "Remove"
      }
    }
  }
});
```

Internally the chart merges the provided values with the defaults, so you only need to override the labels that change.

## Data lifecycle

- Call `draw(data)` for the initial render or whenever you need to rebuild the full dataset (for example when switching symbols or timeframes).
- Call `drawNextPoint(point)` when only the most recent bar changes. The library snaps the timestamp to the active `stepSize`, merges it with the last candle if necessary, and preserves zoom/pan where possible.
- `getData()` returns the mapped data currently drawn; use this to hydrate UI lists or perform calculations without reprocessing your raw feed.

## Events

`FinancialChart` extends a simple event emitter. Subscribe with `chart.on(event, handler)` and store the unsubscribe function to clean up later.

| Event                         | Payload                                         | When it fires                                 |
| ----------------------------- | ----------------------------------------------- | --------------------------------------------- |
| `click`                       | `{ event: PointerEvent, point: Candle }`        | User clicks the chart with a mouse.           |
| `touch-click`                 | `{ event: TouchEvent, point: Candle }`          | User taps the chart on touch devices.         |
| `indicator-visibility-changed` | `{ indicator, visible }`                       | Indicator show/hide buttons are toggled.      |
| `indicator-settings-open`     | `{ indicator }`                                 | Settings button next to an indicator is used. |
| `indicator-remove`            | `{ indicator }`                                 | Indicator remove button is pressed.           |

Use these hooks to open dialogs, sync selections, or feed interactions back into your application state.

## Resizing and cleanup

- The chart observes its container, so any CSS resize automatically triggers a redraw. When embedding inside tabs or accordions, ensure the element is measurable when the chart is created.
- Call `chart.dispose()` when the DOM node is removed. This tears down the `ResizeObserver`, pointer listeners, and animation frame loops to avoid leaks.
