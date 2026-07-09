import {
  ChartUIAdapter,
  IndicatorLabelActions,
  IndicatorLabelActionTitles,
  IndicatorLabelDescriptor,
  IndicatorLabelHandle
} from "./chart-ui-adapter";

/**
 * Default, framework-agnostic UI adapter. Renders indicator labels from their
 * HTML template and wires the show/hide/settings/remove controls via
 * `data-id` hooks — identical to the library's original built-in behavior.
 */
export class WebUIAdapter implements ChartUIAdapter {
  createIndicatorLabel(
    descriptor: IndicatorLabelDescriptor,
    actions: IndicatorLabelActions
  ): IndicatorLabelHandle {
    const root = document.createElement("div");
    root.style.position = "relative";
    root.style.zIndex = "101";
    root.style.width = "fit-content";
    root.classList.add("financial-indicator");
    root.innerHTML = descriptor.templateHtml;

    const label = root.querySelector('[data-id="label"]') as HTMLElement | null;
    const hide = root.querySelector('[data-id="hide"]') as HTMLElement | null;
    const show = root.querySelector('[data-id="show"]') as HTMLElement | null;
    const settings = root.querySelector(
      '[data-id="settings"]'
    ) as HTMLElement | null;
    const remove = root.querySelector(
      '[data-id="remove"]'
    ) as HTMLElement | null;

    const disposers: Array<() => void> = [];
    const on = (element: HTMLElement | null, listener: () => void) => {
      if (!element) return;
      element.addEventListener("click", listener);
      disposers.push(() => element.removeEventListener("click", listener));
    };

    const setVisible = (visible: boolean) => {
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
      setVisible(true);
      actions.onToggleVisibility(true);
    });
    on(show, () => {
      setVisible(false);
      actions.onToggleVisibility(false);
    });
    on(settings, () => actions.onOpenSettings());
    on(remove, () => actions.onRemove());

    const setActionTitles = (titles: IndicatorLabelActionTitles) => {
      // Titles are intentionally cross-wired: the "hide" control shows the
      // "show" tooltip and vice versa (matches the original behavior).
      if (hide) hide.title = titles.show;
      if (show) show.title = titles.hide;
      if (settings) settings.title = titles.settings;
      if (remove) remove.title = titles.remove;
    };

    setActionTitles(descriptor.actionTitles);

    return {
      root,
      setActionTitles,
      setVisible,
      destroy: () => {
        for (const dispose of disposers.splice(0)) dispose();
      }
    };
  }
}
