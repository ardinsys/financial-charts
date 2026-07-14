# DOM adapter

`ChartDOMAdapter` is the non-canvas UI seam. The chart renders market data, axes, grid, and crosshair labels on canvas; the adapter owns DOM chrome such as the overlay region, indicator labels/actions, and pane dividers.

## ChartDOMAdapter

```ts
interface ChartDOMAdapter {
  createOverlay(
    host: HTMLElement,
    context: ChartDOMOverlayContext
  ): ChartDOMOverlay;

  createIndicatorLabel(
    model: IndicatorLabelModel,
    actions: IndicatorLabelActions
  ): IndicatorLabelHandle;

  createPaneDivider?(
    model: PaneDividerModel,
    actions: PaneDividerActions
  ): PaneDividerHandle;
}
```

Use `DefaultDOMAdapter` when CSS hooks are enough. Pass a custom adapter in `ChartOptions.domAdapter` when your app should render labels or pane dividers through its own DOM primitives.

## Overlay

`createOverlay(host, context)` is called once during chart construction.

| Value                     | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `host`                    | Core-owned chart host that also contains canvases.     |
| `context.themeKey`        | Active theme key.                                      |
| `context.labelTopOffset`  | Top offset for the indicator label region.             |
| `indicatorLabelContainer` | Element where the chart appends indicator label roots. |
| `update(context)`         | Repositions or rethemes overlay DOM.                   |
| `destroy()`               | Removes overlay DOM and listeners.                     |

## Indicator labels

`IndicatorLabelModel` is declarative label state:

| Field          | Description                                                    |
| -------------- | -------------------------------------------------------------- |
| `instanceId`   | Unique identity of this configured indicator instance.         |
| `typeId`       | Stable factory/type identifier shared by same-type instances.  |
| `labelKey`     | Stable application-facing identifier for the label kind.       |
| `themeKey`     | Active theme key.                                              |
| `name`         | Localized display name.                                        |
| `detail`       | Optional parameter/source text such as `20 close`.             |
| `segments`     | Current value segments, each with `text` and optional `color`. |
| `visible`      | Current indicator visibility.                                  |
| `actions`      | Which controls should render.                                  |
| `actionTitles` | Localized action labels/tooltips.                              |

The adapter returns a handle:

| Method          | Description                                             |
| --------------- | ------------------------------------------------------- |
| `root`          | Element the chart mounts into the label region or pane. |
| `update(model)` | Re-render from new label state.                         |
| `destroy()`     | Remove listeners and adapter-owned resources.           |

Action callbacks keep behavior in the chart core: `onToggleVisibility(visible)`, `onOpenSettings()`, and `onRemove()`.

## Pane dividers

`createPaneDivider(model, actions)` renders the draggable hit area between panes. The method is optional; if a custom adapter omits it, the chart uses the default divider.

| Model field                    | Description                            |
| ------------------------------ | -------------------------------------- |
| `key`                          | Stable divider key.                    |
| `themeKey`                     | Active theme key.                      |
| `beforePaneId` / `afterPaneId` | Adjacent pane ids.                     |
| `x`, `y`, `width`, `height`    | Logical pixel bounds for the hit area. |

Call `actions.onPointerDown(event)` from the divider's pointer-down handler to let the chart run pane resizing.

## Default DOM hooks

`DefaultDOMAdapter` exposes stable CSS and data hooks for restyling:

- Overlay: `.fci-overlay`, `.fci-indicator-labels`, `data-id="indicator-labels"`.
- Label root: `.financial-indicator`, `.fci-indicator`,
  `data-id="indicator-label"`, `data-indicator-instance-id`,
  `data-indicator-type`, and `data-indicator-label-key`.
- Label parts: `.fci-wrapper`, `.fci-label`, `.fci-name`, `.fci-extra`, `.fci-value`, `.fci-value-segment`.
- Actions: `.fci-actions`, `.fci-btn`, `.fci-action`, `.fci-action-show`, `.fci-action-hide`, `.fci-action-settings`, `.fci-action-remove`.
- States: `.fci-hide`, `.fci-hidden`.
- Pane dividers: `.fci-pane-divider`, `.fci-pane-divider-line`, `data-id="pane-divider"`.

See [Design-system adapter](/guide/design-system-adapter) for a complete custom adapter example.
