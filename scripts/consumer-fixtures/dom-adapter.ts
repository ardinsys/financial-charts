import {
  DefaultDOMAdapter,
  type IndicatorLabelActions,
  type IndicatorLabelHandle,
  type IndicatorLabelModel,
  type PaneDividerActions,
  type PaneDividerHandle,
  type PaneDividerModel
} from "@ardinsys/financial-charts/extensions";
import { bindEvent } from "@ardinsys/financial-charts/engine";

class DesignSystemAdapter extends DefaultDOMAdapter {
  override createIndicatorLabel(
    model: IndicatorLabelModel,
    actions: IndicatorLabelActions
  ): IndicatorLabelHandle {
    const root = document.createElement("div");
    const title = document.createElement("strong");
    const values = document.createElement("span");
    const toggle = document.createElement("button");
    root.append(title, values, toggle);

    let visible = model.visible;
    const update = (next: IndicatorLabelModel) => {
      visible = next.visible;
      root.dataset.indicatorInstanceId = next.instanceId;
      root.dataset.indicatorType = next.typeId;
      root.dataset.indicatorLabelKey = next.labelKey;
      title.textContent = next.name;
      values.replaceChildren(
        ...next.segments.map((segment) => {
          const value = document.createElement("span");
          value.textContent = segment.text;
          if (segment.color) value.style.color = segment.color;
          return value;
        })
      );
      toggle.textContent = next.visible
        ? next.actionTitles.hide
        : next.actionTitles.show;
    };
    const dispose = bindEvent(toggle, "click", () => {
      actions.onToggleVisibility(!visible);
    });
    update(model);

    return {
      root,
      update,
      destroy: dispose
    };
  }

  override createPaneDivider(
    model: PaneDividerModel,
    actions: PaneDividerActions
  ): PaneDividerHandle {
    const root = document.createElement("div");
    root.setAttribute("role", "separator");
    const update = (next: PaneDividerModel) => {
      Object.assign(root.style, {
        position: "absolute",
        left: `${next.x}px`,
        top: `${next.y}px`,
        width: `${next.width}px`,
        height: `${next.height}px`
      });
    };
    const dispose = bindEvent(root, "pointerdown", (event) => {
      actions.onPointerDown(event);
    });
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

const adapter = new DesignSystemAdapter();
void adapter;
