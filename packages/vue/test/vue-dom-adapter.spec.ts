import { createApp, defineComponent, h, nextTick, type PropType } from "vue";
import { describe, expect, it, vi } from "vitest";
import type {
  IndicatorLabelActions,
  IndicatorLabelModel,
  PaneDividerModel,
} from "@ardinsys/financial-charts/extensions";
import type { IndicatorLabelRendererProps } from "../src/types";
import { VueDOMAdapter } from "../src/vue-dom-adapter";
import { VueDOMPortals } from "../src/vue-dom-portals";

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

describe("VueDOMAdapter", () => {
  it("renders and updates a label selected by labelKey", async () => {
    const onRemove = vi.fn();
    const actions: IndicatorLabelActions = {
      onToggleVisibility: vi.fn(),
      onOpenSettings: vi.fn(),
      onRemove,
    };
    const OrderLabel = defineComponent({
      props: {
        model: {
          type: Object as PropType<IndicatorLabelRendererProps["model"]>,
          required: true,
        },
        actions: {
          type: Object as PropType<IndicatorLabelRendererProps["actions"]>,
          required: true,
        },
      },
      setup(props) {
        return () =>
          h(
            "button",
            {
              class: "order-label",
              onClick: props.actions.onRemove,
            },
            `${props.model.name} ${props.model.detail}`,
          );
      },
    });
    const adapter = new VueDOMAdapter({
      indicatorLabels: { orders: OrderLabel },
    });
    const appHost = document.body.appendChild(document.createElement("div"));
    const app = createApp({
      render: () => h(VueDOMPortals, { adapter }),
    });
    app.mount(appHost);

    const handle = adapter.createIndicatorLabel(labelModel, actions);
    document.body.appendChild(handle.root);
    await nextTick();

    const label = handle.root.querySelector<HTMLButtonElement>(".order-label");
    expect(label?.textContent).toBe("Orders (2)");
    expect(handle.root.dataset.indicatorLabelKey).toBe("orders");

    handle.update({ ...labelModel, name: "Trades", detail: "(3)" });
    await nextTick();
    expect(label?.textContent).toBe("Trades (3)");

    label?.click();
    expect(onRemove).toHaveBeenCalledOnce();

    handle.destroy();
    await nextTick();
    expect(handle.root.isConnected).toBe(false);
    app.unmount();
    appHost.remove();
  });

  it("uses the core DOM adapter when no Vue label matches", () => {
    const adapter = new VueDOMAdapter({ indicatorLabels: {} });
    const handle = adapter.createIndicatorLabel(labelModel, {
      onToggleVisibility: vi.fn(),
      onOpenSettings: vi.fn(),
      onRemove: vi.fn(),
    });

    expect(adapter.indicatorLabelEntries).toHaveLength(0);
    expect(handle.root.querySelector('[data-id="name"]')?.textContent).toBe(
      "Orders",
    );
    handle.destroy();
  });

  it("keeps pane dragging native while Vue renders its appearance", async () => {
    const Divider = defineComponent({
      props: {
        model: {
          type: Object as PropType<PaneDividerModel>,
          required: true,
        },
      },
      setup(props) {
        return () => h("span", { class: "divider" }, props.model.themeKey);
      },
    });
    const adapter = new VueDOMAdapter({ paneDivider: Divider });
    const appHost = document.body.appendChild(document.createElement("div"));
    const app = createApp({
      render: () => h(VueDOMPortals, { adapter }),
    });
    app.mount(appHost);
    const onPointerDown = vi.fn();
    const handle = adapter.createPaneDivider(dividerModel, { onPointerDown });
    document.body.appendChild(handle.root);
    await nextTick();

    expect(handle.root.querySelector(".divider")?.textContent).toBe("light");
    expect(handle.root.style.top).toBe("100px");
    handle.root.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
    );
    expect(onPointerDown).toHaveBeenCalledOnce();

    handle.update({ ...dividerModel, themeKey: "dark", y: 140 });
    await nextTick();
    expect(handle.root.querySelector(".divider")?.textContent).toBe("dark");
    expect(handle.root.style.top).toBe("140px");

    handle.destroy();
    app.unmount();
    appHost.remove();
  });
});
