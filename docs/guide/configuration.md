# Configuration

Fine tune the chart runtime by updating the core options, toggling volume, and reacting to user events.

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

### Auto range

Pass `"auto"` as the first argument to let the chart compute the visible range from your data. This is useful when the feed is pre-trimmed to the desired window.

```ts
chart.updateCoreOptions("auto", 15 * 60 * 1000, 150);
```

## Interactions

- **Zooming:** Pinch or scroll to zoom. Combine with programmatic calls to `updateCoreOptions` for custom zoom controls.
- **Panning:** Drag the chart to move in time, or update the `panOffset` via your own UI by calling `setPanOffset`.
- **Overlays:** Register additional controllers to display indicators or custom drawings.

## Switching controllers

Switch the active controller without recreating the chart. Internal state such as pan and zoom is preserved.

```ts
chart.changeType("hlc-area");
```

## Toggling volume

Enable or disable the volume series dynamically with `setVolumeDraw`.

```ts
chart.setVolumeDraw(true);
```

## Updating the locale

Provide locale strings during instantiation or with `updateLocale`. Combine with custom formatters for full control over labels.

```ts
chart.updateLocale("EN", {
  EN: {
    indicator: {
      sma: "Simple Moving Average"
    }
  }
});
```
