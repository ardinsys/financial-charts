import { DefaultDOMAdapter } from "@ardinsys/financial-charts";
import type {
  ChartDOMAdapter,
  ChartDOMOverlay,
  ChartDOMOverlayContext,
  IndicatorLabelActions,
  IndicatorLabelHandle,
  IndicatorLabelModel,
  PaneDividerActions,
  PaneDividerHandle,
  PaneDividerModel,
} from "@ardinsys/financial-charts/extensions";
import {
  shallowReactive,
  shallowRef,
  toRaw,
  type Component,
  type ShallowRef,
} from "vue";
import type {
  IndicatorLabelRenderer,
  PaneDividerRenderer,
  VueDOMAdapterOptions,
} from "./types";

export interface VueIndicatorLabelEntry {
  readonly key: number;
  readonly root: HTMLElement;
  readonly component: IndicatorLabelRenderer;
  readonly model: ShallowRef<IndicatorLabelModel>;
  readonly actions: IndicatorLabelActions;
}

export interface VuePaneDividerEntry {
  readonly key: number;
  readonly root: HTMLElement;
  readonly component: PaneDividerRenderer;
  readonly model: ShallowRef<PaneDividerModel>;
}

export class VueDOMAdapter implements ChartDOMAdapter {
  private readonly defaultAdapter = new DefaultDOMAdapter();
  private readonly fallback: ChartDOMAdapter;
  private readonly defaultIndicatorLabel?: IndicatorLabelRenderer;
  private readonly indicatorLabels?: Readonly<
    Record<string, IndicatorLabelRenderer>
  >;
  private readonly paneDivider?: PaneDividerRenderer;
  private readonly labels = shallowReactive(
    new Map<number, VueIndicatorLabelEntry>(),
  );
  private readonly dividers = shallowReactive(
    new Map<number, VuePaneDividerEntry>(),
  );
  private nextKey = 0;

  constructor(options: VueDOMAdapterOptions = {}) {
    this.fallback = options.fallback ?? this.defaultAdapter;
    this.defaultIndicatorLabel = unwrapComponent(options.indicatorLabel);
    this.indicatorLabels = options.indicatorLabels;
    this.paneDivider = unwrapComponent(options.paneDivider);
  }

  get indicatorLabelEntries(): readonly VueIndicatorLabelEntry[] {
    return Array.from(this.labels.values());
  }

  get paneDividerEntries(): readonly VuePaneDividerEntry[] {
    return Array.from(this.dividers.values());
  }

  createOverlay(
    host: HTMLElement,
    context: ChartDOMOverlayContext,
  ): ChartDOMOverlay {
    return this.fallback.createOverlay(host, context);
  }

  createIndicatorLabel(
    model: IndicatorLabelModel,
    actions: IndicatorLabelActions,
  ): IndicatorLabelHandle {
    const component = this.resolveIndicatorLabel(model.labelKey);
    if (!component) {
      return this.fallback.createIndicatorLabel(model, actions);
    }

    const root = document.createElement("div");
    root.style.position = "relative";
    root.style.zIndex = "101";
    root.style.width = "fit-content";
    root.classList.add("financial-indicator", "fci-indicator");
    root.dataset.id = "indicator-label";

    const key = this.nextKey++;
    const entry: VueIndicatorLabelEntry = {
      key,
      root,
      component,
      model: shallowRef(model),
      actions,
    };
    this.labels.set(key, entry);
    applyIndicatorLabelModel(root, model);

    let destroyed = false;
    return {
      root,
      update: (next) => {
        if (destroyed) return;
        applyIndicatorLabelModel(root, next);
        entry.model.value = next;
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        this.labels.delete(key);
        root.remove();
      },
    };
  }

  createPaneDivider(
    model: PaneDividerModel,
    actions: PaneDividerActions,
  ): PaneDividerHandle {
    if (!this.paneDivider) {
      return (
        this.fallback.createPaneDivider?.(model, actions) ??
        this.defaultAdapter.createPaneDivider(model, actions)
      );
    }

    const root = document.createElement("div");
    root.style.position = "absolute";
    root.style.zIndex = "102";
    root.style.cursor = "row-resize";
    root.style.touchAction = "none";
    root.classList.add("fci-pane-divider");
    root.dataset.id = "pane-divider";
    root.setAttribute("role", "separator");
    root.setAttribute("aria-orientation", "horizontal");
    root.tabIndex = 0;

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      actions.onPointerDown(event);
    };
    root.addEventListener("pointerdown", onPointerDown);

    const key = this.nextKey++;
    const entry: VuePaneDividerEntry = {
      key,
      root,
      component: this.paneDivider,
      model: shallowRef(model),
    };
    this.dividers.set(key, entry);
    applyPaneDividerModel(root, model);

    let destroyed = false;
    return {
      root,
      update: (next) => {
        if (destroyed) return;
        applyPaneDividerModel(root, next);
        entry.model.value = next;
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        root.removeEventListener("pointerdown", onPointerDown);
        this.dividers.delete(key);
        root.remove();
      },
    };
  }

  private resolveIndicatorLabel(
    labelKey: string,
  ): IndicatorLabelRenderer | undefined {
    return (
      unwrapComponent(this.indicatorLabels?.[labelKey]) ??
      this.defaultIndicatorLabel
    );
  }
}

function unwrapComponent<T extends Component>(
  component: T | undefined,
): T | undefined {
  if (!component || typeof component !== "object") return component;
  return toRaw(component) as T;
}

function applyIndicatorLabelModel(
  root: HTMLElement,
  model: IndicatorLabelModel,
): void {
  root.dataset.indicatorInstanceId = model.instanceId;
  root.dataset.indicatorType = model.typeId;
  root.dataset.indicatorLabelKey = model.labelKey;
  root.dataset.themeKey = model.themeKey;
}

function applyPaneDividerModel(
  root: HTMLElement,
  model: PaneDividerModel,
): void {
  root.style.left = `${model.x}px`;
  root.style.top = `${model.y}px`;
  root.style.width = `${model.width}px`;
  root.style.height = `${model.height}px`;
  root.dataset.key = model.key;
  root.dataset.themeKey = model.themeKey;
  root.dataset.beforePaneId = String(model.beforePaneId);
  root.dataset.afterPaneId = String(model.afterPaneId);
}
