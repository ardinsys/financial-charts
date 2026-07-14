import {
  ChartDOMOverlay,
  ChartDOMOverlayContext,
  ChartDOMAdapter,
  IndicatorLabelActions,
  IndicatorLabelHandle,
  IndicatorLabelModel,
  PaneDividerActions,
  PaneDividerHandle,
  PaneDividerModel
} from "./chart-dom-adapter";
import { ICON_HIDE, ICON_REMOVE, ICON_SETTINGS, ICON_SHOW } from "./icons";
import { bindEvent, createPositionedContainer } from "../utils/dom";

/**
 * Default DOM adapter. Renders the indicator label model to DOM (with the
 * built-in `fci-*` classes and `data-id` hooks), wires the
 * show/hide/settings/remove controls, and renders pane dividers.
 */
export class DefaultDOMAdapter implements ChartDOMAdapter {
  createOverlay(
    host: HTMLElement,
    context: ChartDOMOverlayContext
  ): ChartDOMOverlay {
    const indicatorLabelContainer = createPositionedContainer({
      zIndex: 101,
      overflow: "auto",
      top: context.labelTopOffset,
      left: 10,
      width: "fit-content"
    });
    indicatorLabelContainer.classList.add(
      "fci-overlay",
      "fci-indicator-labels"
    );
    indicatorLabelContainer.dataset.id = "indicator-labels";
    indicatorLabelContainer.dataset.themeKey = context.themeKey;
    host.appendChild(indicatorLabelContainer);

    return {
      indicatorLabelContainer,
      update: (next: ChartDOMOverlayContext) => {
        indicatorLabelContainer.style.top = next.labelTopOffset + "px";
        indicatorLabelContainer.dataset.themeKey = next.themeKey;
      },
      destroy: () => {
        indicatorLabelContainer.remove();
      }
    };
  }

  createIndicatorLabel(
    model: IndicatorLabelModel,
    actions: IndicatorLabelActions
  ): IndicatorLabelHandle {
    const root = createPositionedContainer({
      position: "relative",
      zIndex: 101,
      width: "fit-content"
    });
    root.classList.add("financial-indicator", "fci-indicator");
    root.dataset.id = "indicator-label";
    root.dataset.indicatorInstanceId = model.instanceId;
    root.dataset.indicatorType = model.typeId;
    root.dataset.indicatorLabelKey = model.labelKey;
    root.dataset.themeKey = model.themeKey;

    const button = (id: string, icon: string, extraClass = "") =>
      `<button type="button" class="fci-btn fci-action fci-action-${id} ${extraClass}" data-id="${id}" data-action="${id}">${icon}</button>`;

    const controls = [
      model.actions.canHide ? button("show", ICON_SHOW) : "",
      model.actions.canHide ? button("hide", ICON_HIDE, "fci-hide") : "",
      model.actions.canOpenSettings ? button("settings", ICON_SETTINGS) : "",
      model.actions.canRemove ? button("remove", ICON_REMOVE) : ""
    ].join("");

    root.innerHTML = /* html */ `
      <div class="fci-wrapper">
        <div class="fci-label" data-id="label">
          <span class="fci-name" data-id="name"></span>
          <span class="fci-extra" data-id="extra"></span>
          <span class="fci-value" data-id="value"></span>
        </div>
        <div class="fci-actions">${controls}</div>
      </div>
    `;

    const q = (id: string) =>
      root.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
    const label = q("label");
    const name = q("name");
    const extra = q("extra");
    const value = q("value");
    const show = q("show");
    const hide = q("hide");
    const settings = q("settings");
    const remove = q("remove");

    const disposers: Array<() => void> = [];
    const on = (element: HTMLElement | null, listener: () => void) => {
      if (!element) return;
      disposers.push(bindEvent(element, "click", listener));
    };

    const applyVisible = (visible: boolean) => {
      if (visible) {
        show?.classList.remove("fci-hide");
        hide?.classList.add("fci-hide");
        label?.classList.remove("fci-hidden");
      } else {
        hide?.classList.remove("fci-hide");
        show?.classList.add("fci-hide");
        label?.classList.add("fci-hidden");
      }
    };

    on(hide, () => {
      applyVisible(true);
      actions.onToggleVisibility(true);
    });
    on(show, () => {
      applyVisible(false);
      actions.onToggleVisibility(false);
    });
    on(settings, () => actions.onOpenSettings());
    on(remove, () => actions.onRemove());

    const update = (next: IndicatorLabelModel) => {
      if (name) name.textContent = next.name;
      if (extra) extra.textContent = next.detail ?? "";
      root.dataset.indicatorInstanceId = next.instanceId;
      root.dataset.indicatorType = next.typeId;
      root.dataset.indicatorLabelKey = next.labelKey;
      root.dataset.themeKey = next.themeKey;
      if (value) {
        value.replaceChildren(
          ...next.segments.map((segment, index) => {
            const span = document.createElement("span");
            span.classList.add("fci-value-segment");
            span.dataset.index = String(index);
            span.textContent = segment.text;
            if (segment.color) span.style.color = segment.color;
            if (index > 0) span.style.marginLeft = "4px";
            return span;
          })
        );
      }
      // Titles are intentionally cross-wired: the "hide" control shows the
      // "show" tooltip and vice versa (matches the original behavior).
      if (hide) hide.title = next.actionTitles.show;
      if (show) show.title = next.actionTitles.hide;
      if (settings) settings.title = next.actionTitles.settings;
      if (remove) remove.title = next.actionTitles.remove;
      if (hide) hide.setAttribute("aria-label", next.actionTitles.show);
      if (show) show.setAttribute("aria-label", next.actionTitles.hide);
      if (settings) {
        settings.setAttribute("aria-label", next.actionTitles.settings);
      }
      if (remove) remove.setAttribute("aria-label", next.actionTitles.remove);
      applyVisible(next.visible);
    };

    update(model);

    return {
      root,
      update,
      destroy: () => {
        for (const dispose of disposers.splice(0)) dispose();
      }
    };
  }

  createPaneDivider(
    model: PaneDividerModel,
    actions: PaneDividerActions
  ): PaneDividerHandle {
    const root = createPositionedContainer({
      zIndex: 102,
      left: model.x,
      top: model.y,
      width: model.width,
      height: model.height
    });
    root.classList.add("fci-pane-divider");
    root.dataset.id = "pane-divider";
    root.dataset.key = model.key;
    root.dataset.themeKey = model.themeKey;
    root.dataset.beforePaneId = String(model.beforePaneId);
    root.dataset.afterPaneId = String(model.afterPaneId);
    root.setAttribute("role", "separator");
    root.setAttribute("aria-orientation", "horizontal");
    root.tabIndex = 0;
    root.innerHTML = `<div class="fci-pane-divider-line" data-id="pane-divider-line"></div>`;
    root.style.cursor = "row-resize";
    root.style.touchAction = "none";

    const dispose = bindEvent(root, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.onPointerDown(event);
    });

    const update = (next: PaneDividerModel) => {
      root.style.left = next.x + "px";
      root.style.top = next.y + "px";
      root.style.width = next.width + "px";
      root.style.height = next.height + "px";
      root.dataset.key = next.key;
      root.dataset.themeKey = next.themeKey;
      root.dataset.beforePaneId = String(next.beforePaneId);
      root.dataset.afterPaneId = String(next.afterPaneId);
    };

    update(model);

    return {
      root,
      update,
      destroy: () => {
        dispose();
        root.remove();
      }
    };
  }
}
