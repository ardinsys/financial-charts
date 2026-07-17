# Design-system adapter

Financial charts draws market data on canvas, but overlay UI is routed through `ChartDOMAdapter`. Use the default adapter when CSS hooks are enough, or pass your own adapter when labels and pane dividers should be rendered by your design system.

## Restyle the default overlay

Import the shipped stylesheet, then override the stable classes inside your chart container.

```css
.trading-workspace .fci-indicator {
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  box-shadow: var(--shadow-sm);
  color: var(--text);
}

.trading-workspace .fci-actions {
  gap: 6px;
}

.trading-workspace .fci-action {
  color: var(--text-muted);
}

.trading-workspace .fci-action:hover {
  color: var(--accent);
}

.trading-workspace .fci-pane-divider-line {
  background: var(--border-strong);
}
```

Default DOM hooks:

| Hook                                                                                 | Purpose                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `.financial-charts`                                                                  | Root chart host.                               |
| `.financial-charts-${key}`                                                           | Active registered theme key class.             |
| `.financial-charts-light` / `.financial-charts-dark`                                 | Resolved base family, including custom themes. |
| `.fci-overlay`                                                                       | Adapter-owned overlay region.                  |
| `.fci-indicator-labels`                                                              | Container that receives indicator label roots. |
| `.financial-indicator` / `.fci-indicator`                                            | Indicator label root.                          |
| `.fci-wrapper`                                                                       | Label + action row.                            |
| `.fci-label`                                                                         | Text/value label group.                        |
| `.fci-name`                                                                          | Indicator display name.                        |
| `.fci-extra`                                                                         | Indicator detail text such as `20 close`.      |
| `.fci-value`                                                                         | Container for current crosshair values.        |
| `.fci-value-segment`                                                                 | One colored value segment.                     |
| `.fci-actions`                                                                       | Button group.                                  |
| `.fci-btn` / `.fci-action`                                                           | Any default action button.                     |
| `.fci-action-show`, `.fci-action-hide`, `.fci-action-settings`, `.fci-action-remove` | Specific action buttons.                       |
| `.fci-hide`                                                                          | Internal hidden-state helper.                  |
| `.fci-hidden`                                                                        | Hidden indicator label state.                  |
| `.fci-pane-divider`                                                                  | Draggable pane divider hit area.               |
| `.fci-pane-divider-line`                                                             | Visible divider line.                          |

The default adapter also adds `data-id` hooks for tests and integration code: `indicator-labels`, `indicator-label`, `label`, `name`, `extra`, `value`, `show`, `hide`, `settings`, `remove`, `pane-divider`, and `pane-divider-line`.

## Replace labels and dividers

Pass a custom adapter when the DOM should be app-owned. The model is declarative: the core tells you the indicator name, detail, visible state, action titles, and value segments; your adapter renders them however it wants.

`onToggleVisibility()` receives the resulting visibility. A control displaying
the hide action passes `false`; a control displaying the show action passes
`true`. The chart mounts label and divider roots, while the adapter owns their
listeners and child DOM until `destroy()`.

```ts
import {
  DefaultDOMAdapter,
  type IndicatorLabelActions,
  type IndicatorLabelHandle,
  type IndicatorLabelModel,
  type PaneDividerActions,
  type PaneDividerHandle,
  type PaneDividerModel
} from "@ardinsys/financial-charts/extensions";
import { FinancialChart } from "@ardinsys/financial-charts";
import { bindEvent } from "@ardinsys/financial-charts/engine";

class DesignSystemAdapter extends DefaultDOMAdapter {
  createIndicatorLabel(
    model: IndicatorLabelModel,
    actions: IndicatorLabelActions
  ): IndicatorLabelHandle {
    const root = document.createElement("div");
    root.className = "ds-chart-indicator";

    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const values = document.createElement("span");
    const toggle = document.createElement("button");
    const settings = document.createElement("button");
    const remove = document.createElement("button");

    root.append(title, detail, values, toggle, settings, remove);

    let visible = model.visible;
    const render = (next: IndicatorLabelModel) => {
      visible = next.visible;
      root.dataset.indicatorInstanceId = next.instanceId;
      root.dataset.indicatorType = next.typeId;
      root.dataset.indicatorLabelKey = next.labelKey;
      root.dataset.visible = String(next.visible);
      title.textContent = next.name;
      detail.textContent = next.detail ?? "";
      values.replaceChildren(
        ...next.segments.map((segment) => {
          const span = document.createElement("span");
          span.textContent = segment.text;
          if (segment.color) span.style.color = segment.color;
          return span;
        })
      );
      toggle.textContent = next.visible
        ? next.actionTitles.hide
        : next.actionTitles.show;
      settings.textContent = next.actionTitles.settings;
      remove.textContent = next.actionTitles.remove;
    };

    const disposers = [
      bindEvent(toggle, "click", () => actions.onToggleVisibility(!visible)),
      bindEvent(settings, "click", () => actions.onOpenSettings()),
      bindEvent(remove, "click", () => actions.onRemove())
    ];

    render(model);

    return {
      root,
      update: render,
      destroy: () => disposers.forEach((dispose) => dispose())
    };
  }

  createPaneDivider(
    model: PaneDividerModel,
    actions: PaneDividerActions
  ): PaneDividerHandle {
    const root = document.createElement("div");
    root.className = "ds-pane-resizer";
    root.setAttribute("role", "separator");
    root.setAttribute("aria-orientation", "horizontal");

    const render = (next: PaneDividerModel) => {
      Object.assign(root.style, {
        position: "absolute",
        left: next.x + "px",
        top: next.y + "px",
        width: next.width + "px",
        height: next.height + "px"
      });
    };

    const dispose = bindEvent(root, "pointerdown", (event) => {
      event.preventDefault();
      actions.onPointerDown(event);
    });

    render(model);

    return {
      root,
      update: render,
      destroy: () => {
        dispose();
        root.remove();
      }
    };
  }
}

const chart = new FinancialChart(root, {
  timeRange: "auto",
  type: "candle",
  stepSize: 15 * 60 * 1000,
  maxZoom: 100,
  volume: true,
  domAdapter: new DesignSystemAdapter()
});
```

Adapters can also override `createOverlay(host, context)` when the indicator label region needs to live inside app-owned scaffolding. The returned `indicatorLabelContainer` is the element where the chart appends label roots.

Overlay and handle `update()` calls always contain complete current models, so
the adapter does not need to retain chart objects or inspect indicator
internals. Geometry uses logical CSS pixels. Removing the chart calls every
handle's `destroy()` and then destroys the overlay.

Canvas surfaces such as candles, axes, grid, crosshair labels, and volume remain theme-driven. Register definitions with `themes` and switch them with `chart.updateOptions({ theme: key })`.
