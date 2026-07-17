import { describe, expect, it, vi } from "vitest";
import { DefaultDOMAdapter } from "../src/ui/default-dom-adapter";
import type {
  IndicatorLabelActions,
  IndicatorLabelModel
} from "../src/ui/chart-dom-adapter";

const titles = {
  show: "Show",
  hide: "Hide",
  settings: "Settings",
  remove: "Remove"
};

function model(
  overrides: Partial<IndicatorLabelModel> = {}
): IndicatorLabelModel {
  return {
    instanceId: "sma-1",
    typeId: "moving-average",
    labelKey: "SMA",
    themeKey: "light",
    name: "SMA",
    detail: "10 close",
    segments: [{ text: "12.34", color: "#2962FF" }],
    visible: true,
    actions: { canHide: true, canOpenSettings: true, canRemove: true },
    actionTitles: titles,
    ...overrides
  };
}

function makeLabel(
  actions: Partial<IndicatorLabelActions> = {},
  initial: IndicatorLabelModel = model()
) {
  const adapter = new DefaultDOMAdapter();
  const spies = {
    onToggleVisibility: vi.fn(),
    onOpenSettings: vi.fn(),
    onRemove: vi.fn(),
    ...actions
  };
  const handle = adapter.createIndicatorLabel(initial, spies);
  const q = (id: string) =>
    handle.root.querySelector(`[data-id="${id}"]`) as HTMLElement;
  return { handle, spies, q };
}

describe("DefaultDOMAdapter indicator label", () => {
  it("renders the model name, detail, value segment, and controls", () => {
    const { handle, q } = makeLabel();
    expect(handle.root.classList.contains("financial-indicator")).toBe(true);
    expect(handle.root.classList.contains("fci-indicator")).toBe(true);
    expect(handle.root.dataset.id).toBe("indicator-label");
    expect(handle.root.dataset.indicatorInstanceId).toBe("sma-1");
    expect(handle.root.dataset.indicatorType).toBe("moving-average");
    expect(handle.root.dataset.indicatorLabelKey).toBe("SMA");
    expect(handle.root.dataset.themeKey).toBe("light");
    expect(q("name").textContent).toBe("SMA");
    expect(q("extra").textContent).toBe("10 close");

    const spans = q("value").querySelectorAll("span");
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe("12.34");
    expect(spans[0].classList.contains("fci-value-segment")).toBe(true);
    expect((spans[0] as HTMLElement).dataset.index).toBe("0");
    expect((spans[0] as HTMLElement).style.color).not.toBe("");

    for (const id of ["show", "hide", "settings", "remove"]) {
      const action = q(id) as HTMLButtonElement;
      expect(action).toBeTruthy();
      expect(action.type).toBe("button");
      expect(action.dataset.action).toBe(id);
      expect(action.classList.contains("fci-action")).toBe(true);
      expect(action.classList.contains(`fci-action-${id}`)).toBe(true);
    }
  });

  it("renders multiple colored value segments (e.g. Bollinger/MACD)", () => {
    const { q } = makeLabel(
      {},
      model({
        segments: [
          { text: "1", color: "#ff0000" },
          { text: "2" },
          { text: "3" }
        ]
      })
    );
    const spans = q("value").querySelectorAll("span");
    expect([...spans].map((s) => s.textContent)).toEqual(["1", "2", "3"]);
  });

  it("only renders controls allowed by the model", () => {
    const { q } = makeLabel(
      {},
      model({
        actions: { canHide: true, canOpenSettings: false, canRemove: false }
      })
    );
    expect(q("show")).toBeTruthy();
    expect(q("settings")).toBeNull();
    expect(q("remove")).toBeNull();
  });

  it("labels visibility actions with their resulting operation", () => {
    const { q } = makeLabel();
    expect(q("hide").title).toBe(titles.hide);
    expect(q("show").title).toBe(titles.show);
    expect(q("settings").title).toBe(titles.settings);
    expect(q("remove").title).toBe(titles.remove);
    expect(q("hide").getAttribute("aria-label")).toBe(titles.hide);
    expect(q("show").getAttribute("aria-label")).toBe(titles.show);
    expect(q("settings").getAttribute("aria-label")).toBe(titles.settings);
    expect(q("remove").getAttribute("aria-label")).toBe(titles.remove);
  });

  it("updates design-system data hooks when the label model changes", () => {
    const { handle } = makeLabel();
    handle.update(
      model({
        instanceId: "ema-2",
        typeId: "exponential-moving-average",
        labelKey: "EMA",
        themeKey: "dark"
      })
    );
    expect(handle.root.dataset.indicatorInstanceId).toBe("ema-2");
    expect(handle.root.dataset.indicatorType).toBe(
      "exponential-moving-average"
    );
    expect(handle.root.dataset.indicatorLabelKey).toBe("EMA");
    expect(handle.root.dataset.themeKey).toBe("dark");
  });

  it("routes button clicks to the action callbacks", () => {
    const { spies, q } = makeLabel();

    q("hide").click();
    expect(spies.onToggleVisibility).toHaveBeenLastCalledWith(false);
    q("show").click();
    expect(spies.onToggleVisibility).toHaveBeenLastCalledWith(true);
    q("settings").click();
    expect(spies.onOpenSettings).toHaveBeenCalledTimes(1);
    q("remove").click();
    expect(spies.onRemove).toHaveBeenCalledTimes(1);
  });

  it("reflects visibility from the model on update", () => {
    const { handle, q } = makeLabel();
    handle.update(model({ visible: false }));
    expect(q("label").classList.contains("fci-hidden")).toBe(true);
    expect(q("hide").classList.contains("fci-hide")).toBe(true);
    handle.update(model({ visible: true }));
    expect(q("label").classList.contains("fci-hidden")).toBe(false);
    expect(q("show").classList.contains("fci-hide")).toBe(true);
  });

  it("detaches listeners and removes the label on destroy", () => {
    const { handle, spies, q } = makeLabel();
    document.body.appendChild(handle.root);
    handle.destroy();
    handle.destroy();
    q("remove").click();
    q("hide").click();
    expect(spies.onRemove).not.toHaveBeenCalled();
    expect(spies.onToggleVisibility).not.toHaveBeenCalled();
    expect(handle.root.isConnected).toBe(false);
  });
});

describe("DefaultDOMAdapter overlay", () => {
  it("mounts an absolutely-positioned label region into the host", () => {
    const host = document.createElement("div");
    const overlay = new DefaultDOMAdapter().createOverlay(host, {
      themeKey: "light",
      labelTopOffset: 40
    });
    expect(overlay.indicatorLabelContainer.parentElement).toBe(host);
    expect(overlay.indicatorLabelContainer.style.position).toBe("absolute");
    expect(overlay.indicatorLabelContainer.style.top).toBe("40px");
    expect(
      overlay.indicatorLabelContainer.classList.contains("fci-overlay")
    ).toBe(true);
    expect(
      overlay.indicatorLabelContainer.classList.contains("fci-indicator-labels")
    ).toBe(true);
    expect(overlay.indicatorLabelContainer.dataset.id).toBe("indicator-labels");
    expect(overlay.indicatorLabelContainer.dataset.themeKey).toBe("light");
  });

  it("repositions on update and detaches on destroy", () => {
    const host = document.createElement("div");
    const overlay = new DefaultDOMAdapter().createOverlay(host, {
      themeKey: "light",
      labelTopOffset: 40
    });
    overlay.update({ themeKey: "dark", labelTopOffset: 60 });
    expect(overlay.indicatorLabelContainer.style.top).toBe("60px");
    expect(overlay.indicatorLabelContainer.dataset.themeKey).toBe("dark");
    overlay.destroy();
    expect(overlay.indicatorLabelContainer.parentElement).toBeNull();
  });
});

describe("DefaultDOMAdapter pane divider", () => {
  it("renders, updates, and disposes a pane divider handle", () => {
    const adapter = new DefaultDOMAdapter();
    const onPointerDown = vi.fn();
    const handle = adapter.createPaneDivider(
      {
        key: "divider",
        themeKey: "light",
        beforePaneId: 0,
        afterPaneId: 1,
        x: 0,
        y: 100,
        width: 800,
        height: 8
      },
      { onPointerDown }
    );

    expect(handle.root.classList.contains("fci-pane-divider")).toBe(true);
    expect(handle.root.dataset.id).toBe("pane-divider");
    expect(handle.root.dataset.key).toBe("divider");
    expect(handle.root.dataset.themeKey).toBe("light");
    expect(handle.root.dataset.beforePaneId).toBe("0");
    expect(handle.root.dataset.afterPaneId).toBe("1");
    expect(
      handle.root.querySelector('[data-id="pane-divider-line"]')
    ).toBeTruthy();
    expect(handle.root.style.top).toBe("100px");
    expect(handle.root.style.height).toBe("8px");

    handle.root.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(onPointerDown).toHaveBeenCalledTimes(1);

    handle.update({
      key: "divider",
      themeKey: "dark",
      beforePaneId: 1,
      afterPaneId: 2,
      x: 0,
      y: 180,
      width: 640,
      height: 10
    });
    expect(handle.root.dataset.key).toBe("divider");
    expect(handle.root.dataset.themeKey).toBe("dark");
    expect(handle.root.dataset.beforePaneId).toBe("1");
    expect(handle.root.dataset.afterPaneId).toBe("2");
    expect(handle.root.style.top).toBe("180px");
    expect(handle.root.style.width).toBe("640px");

    handle.destroy();
    handle.root.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    expect(onPointerDown).toHaveBeenCalledTimes(1);
  });
});
