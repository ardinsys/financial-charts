import {
  ChartOverlay,
  ChartOverlayContext,
  ChartUIAdapter,
  IndicatorLabelActions,
  IndicatorLabelHandle,
  IndicatorLabelModel
} from "./chart-ui-adapter";
import { ICON_HIDE, ICON_REMOVE, ICON_SETTINGS, ICON_SHOW } from "./icons";

/**
 * Default, framework-agnostic UI adapter. Renders the indicator label model to
 * DOM (with the built-in `fci-*` classes and `data-id` hooks) and wires the
 * show/hide/settings/remove controls — the library's built-in look and behavior.
 */
export class WebUIAdapter implements ChartUIAdapter {
  createOverlay(host: HTMLElement, context: ChartOverlayContext): ChartOverlay {
    const indicatorLabelContainer = document.createElement("div");
    indicatorLabelContainer.style.zIndex = "101";
    indicatorLabelContainer.style.overflow = "auto";
    indicatorLabelContainer.style.position = "absolute";
    indicatorLabelContainer.style.top = context.labelTopOffset + "px";
    indicatorLabelContainer.style.left = "10px";
    indicatorLabelContainer.style.width = "fit-content";
    host.appendChild(indicatorLabelContainer);

    return {
      indicatorLabelContainer,
      update: (next: ChartOverlayContext) => {
        indicatorLabelContainer.style.top = next.labelTopOffset + "px";
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
    const root = document.createElement("div");
    root.style.position = "relative";
    root.style.zIndex = "101";
    root.style.width = "fit-content";
    root.classList.add("financial-indicator");

    const button = (id: string, icon: string, extraClass = "") =>
      `<button class="fci-btn ${extraClass}" data-id="${id}">${icon}</button>`;

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
      element.addEventListener("click", listener);
      disposers.push(() => element.removeEventListener("click", listener));
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
      if (value) {
        value.replaceChildren(
          ...next.segments.map((segment, index) => {
            const span = document.createElement("span");
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
}
