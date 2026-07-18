import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type {
  IndicatorLabelActions,
  IndicatorLabelHandle,
  IndicatorLabelModel,
  PaneDividerHandle,
  PaneDividerModel,
} from "@ardinsys/financial-charts/extensions";
import type { IndicatorLabelRendererProps } from "../src/types";
import { ReactDOMAdapter } from "../src/react-dom-adapter";
import { ReactDOMPortals } from "../src/react-dom-portals";

const labelModel: IndicatorLabelModel = {
  instanceId: "orders-1",
  typeId: "orders",
  labelKey: "orders",
  themeKey: "light",
  name: "Orders",
  detail: "(2)",
  segments: [{ text: "ACC: 100 (4)", color: "green" }],
  visible: true,
  actions: {
    canHide: true,
    canOpenSettings: true,
    canRemove: true,
  },
  actionTitles: {
    show: "Show",
    hide: "Hide",
    settings: "Settings",
    remove: "Remove",
  },
};

const dividerModel: PaneDividerModel = {
  key: "1-2",
  themeKey: "light",
  beforePaneId: 1,
  afterPaneId: 2,
  x: 0,
  y: 100,
  width: 500,
  height: 8,
};

describe("ReactDOMAdapter", () => {
  it("renders and updates a label selected by labelKey", async () => {
    const onRemove = vi.fn();
    const actions: IndicatorLabelActions = {
      onToggleVisibility: vi.fn(),
      onOpenSettings: vi.fn(),
      onRemove,
    };
    const OrderLabel = ({ model, actions }: IndicatorLabelRendererProps) =>
      createElement(
        "button",
        { className: "order-label", onClick: actions.onRemove },
        `${model.name} ${model.detail}`
      );
    const adapter = new ReactDOMAdapter({
      indicatorLabels: { orders: OrderLabel },
    });
    const appHost = document.body.appendChild(document.createElement("div"));
    const root = createRoot(appHost);
    await act(async () => {
      root.render(createElement(ReactDOMPortals, { adapter }));
    });

    let handle: IndicatorLabelHandle;
    await act(async () => {
      handle = adapter.createIndicatorLabel(labelModel, actions);
      document.body.appendChild(handle.root);
    });

    const label = handle!.root.querySelector<HTMLButtonElement>(".order-label");
    expect(label?.textContent).toBe("Orders (2)");
    expect(handle!.root.dataset.indicatorLabelKey).toBe("orders");

    await act(async () => {
      handle!.update({ ...labelModel, name: "Trades", detail: "(3)" });
    });
    expect(label?.textContent).toBe("Trades (3)");

    await act(async () => label?.click());
    expect(onRemove).toHaveBeenCalledOnce();

    await act(async () => handle!.destroy());
    expect(handle!.root.isConnected).toBe(false);
    await act(async () => root.unmount());
    appHost.remove();
  });

  it("uses the core DOM adapter when no React label matches", () => {
    const adapter = new ReactDOMAdapter({ indicatorLabels: {} });
    const handle = adapter.createIndicatorLabel(labelModel, {
      onToggleVisibility: vi.fn(),
      onOpenSettings: vi.fn(),
      onRemove: vi.fn(),
    });

    expect(adapter.indicatorLabelEntries).toHaveLength(0);
    expect(handle.root.querySelector('[data-id="name"]')?.textContent).toBe(
      "Orders"
    );
    handle.destroy();
  });

  it("keeps pane dragging native while React renders its appearance", async () => {
    const Divider = ({ model }: { model: PaneDividerModel }) =>
      createElement("span", { className: "divider" }, model.themeKey);
    const adapter = new ReactDOMAdapter({ paneDivider: Divider });
    const appHost = document.body.appendChild(document.createElement("div"));
    const root = createRoot(appHost);
    await act(async () => {
      root.render(createElement(ReactDOMPortals, { adapter }));
    });
    const onPointerDown = vi.fn();
    let handle: PaneDividerHandle;
    await act(async () => {
      handle = adapter.createPaneDivider(dividerModel, { onPointerDown });
      document.body.appendChild(handle.root);
    });

    expect(handle!.root.querySelector(".divider")?.textContent).toBe("light");
    expect(handle!.root.style.top).toBe("100px");
    handle!.root.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
    );
    expect(onPointerDown).toHaveBeenCalledOnce();

    await act(async () => {
      handle!.update({ ...dividerModel, themeKey: "dark", y: 140 });
    });
    expect(handle!.root.querySelector(".divider")?.textContent).toBe("dark");
    expect(handle!.root.style.top).toBe("140px");

    await act(async () => handle!.destroy());
    await act(async () => root.unmount());
    appHost.remove();
  });

  it("skips re-rendering a label when the updated model is content-identical", async () => {
    let renders = 0;
    const OrderLabel = ({ model }: IndicatorLabelRendererProps) => {
      renders++;
      return createElement("span", { className: "order-label" }, model.name);
    };
    const adapter = new ReactDOMAdapter({
      indicatorLabels: { orders: OrderLabel },
    });
    const appHost = document.body.appendChild(document.createElement("div"));
    const root = createRoot(appHost);
    await act(async () => {
      root.render(createElement(ReactDOMPortals, { adapter }));
    });

    let handle: IndicatorLabelHandle;
    await act(async () => {
      handle = adapter.createIndicatorLabel(labelModel, {
        onToggleVisibility: vi.fn(),
        onOpenSettings: vi.fn(),
        onRemove: vi.fn(),
      });
      document.body.appendChild(handle.root);
    });
    expect(handle!.root.textContent).toContain("Orders");
    const rendersAfterMount = renders;

    // Same content, new object identity — the shape a crosshair frame
    // produces while the pointer stays within one candle.
    await act(async () => {
      handle!.update({ ...labelModel });
    });
    expect(renders).toBe(rendersAfterMount);

    // A genuine content change must still re-render.
    await act(async () => {
      handle!.update({ ...labelModel, name: "Trades" });
    });
    expect(handle!.root.textContent).toContain("Trades");

    await act(async () => handle!.destroy());
    await act(async () => root.unmount());
    appHost.remove();
  });
});
