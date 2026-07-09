import { describe, expect, it, vi } from "vitest";
import { WebUIAdapter } from "../src/ui/web-ui-adapter";
import { indicatorLabelTemplate } from "../src/indicators/label-renderer";
import type { IndicatorLabelActions } from "../src/ui/chart-ui-adapter";

const titles = { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" };

function makeLabel(actions: Partial<IndicatorLabelActions> = {}) {
  const adapter = new WebUIAdapter();
  const spies = {
    onToggleVisibility: vi.fn(),
    onOpenSettings: vi.fn(),
    onRemove: vi.fn(),
    ...actions
  };
  const handle = adapter.createIndicatorLabel(
    {
      key: "sma",
      themeKey: "light",
      templateHtml: indicatorLabelTemplate.light,
      actionTitles: titles,
      visible: true
    },
    spies
  );
  const q = (id: string) =>
    handle.root.querySelector(`[data-id="${id}"]`) as HTMLElement;
  return { handle, spies, q };
}

describe("WebUIAdapter indicator label", () => {
  it("renders the template with the action controls", () => {
    const { handle, q } = makeLabel();
    expect(handle.root.classList.contains("financial-indicator")).toBe(true);
    for (const id of ["name", "value", "show", "hide", "settings", "remove"]) {
      expect(q(id)).toBeTruthy();
    }
  });

  it("cross-wires action tooltips (hide shows the 'show' title and vice versa)", () => {
    const { q } = makeLabel();
    expect(q("hide").title).toBe(titles.show);
    expect(q("show").title).toBe(titles.hide);
    expect(q("settings").title).toBe(titles.settings);
    expect(q("remove").title).toBe(titles.remove);
  });

  it("routes button clicks to the action callbacks", () => {
    const { spies, q } = makeLabel();

    q("hide").click();
    expect(spies.onToggleVisibility).toHaveBeenLastCalledWith(true);
    q("show").click();
    expect(spies.onToggleVisibility).toHaveBeenLastCalledWith(false);
    q("settings").click();
    expect(spies.onOpenSettings).toHaveBeenCalledTimes(1);
    q("remove").click();
    expect(spies.onRemove).toHaveBeenCalledTimes(1);
  });

  it("toggles visibility classes via setVisible", () => {
    const { handle, q } = makeLabel();
    handle.setVisible(false);
    expect(q("label").classList.contains("fci-hidden")).toBe(true);
    expect(q("show").classList.contains("fci-hide")).toBe(true);
    handle.setVisible(true);
    expect(q("label").classList.contains("fci-hidden")).toBe(false);
    expect(q("hide").classList.contains("fci-hide")).toBe(true);
  });

  it("detaches listeners on destroy", () => {
    const { handle, spies, q } = makeLabel();
    handle.destroy();
    q("remove").click();
    q("hide").click();
    expect(spies.onRemove).not.toHaveBeenCalled();
    expect(spies.onToggleVisibility).not.toHaveBeenCalled();
  });
});
