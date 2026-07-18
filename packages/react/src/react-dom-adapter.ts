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
import type {
  IndicatorLabelRenderer,
  PaneDividerRenderer,
  ReactDOMAdapterOptions,
} from "./types";

type Listener = () => void;

export interface ReactModelEntry<T> {
  getModel(): T;
  subscribe(listener: Listener): () => void;
}

export interface ReactIndicatorLabelEntry extends ReactModelEntry<IndicatorLabelModel> {
  readonly key: number;
  readonly root: HTMLElement;
  readonly component: IndicatorLabelRenderer;
  readonly actions: IndicatorLabelActions;
}

export interface ReactPaneDividerEntry extends ReactModelEntry<PaneDividerModel> {
  readonly key: number;
  readonly root: HTMLElement;
  readonly component: PaneDividerRenderer;
}

export class ReactDOMAdapter implements ChartDOMAdapter {
  private readonly defaultAdapter = new DefaultDOMAdapter();
  private readonly fallback: ChartDOMAdapter;
  private readonly defaultIndicatorLabel?: IndicatorLabelRenderer;
  private readonly indicatorLabels?: Readonly<
    Record<string, IndicatorLabelRenderer>
  >;
  private readonly paneDivider?: PaneDividerRenderer;
  private readonly labels = new Map<number, ReactIndicatorLabelEntry>();
  private readonly dividers = new Map<number, ReactPaneDividerEntry>();
  private readonly listeners = new Set<Listener>();
  private nextKey = 0;

  constructor(options: ReactDOMAdapterOptions = {}) {
    this.fallback = options.fallback ?? this.defaultAdapter;
    this.defaultIndicatorLabel = options.indicatorLabel;
    this.indicatorLabels = options.indicatorLabels;
    this.paneDivider = options.paneDivider;
  }

  get indicatorLabelEntries(): readonly ReactIndicatorLabelEntry[] {
    return Array.from(this.labels.values());
  }

  get paneDividerEntries(): readonly ReactPaneDividerEntry[] {
    return Array.from(this.dividers.values());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener();
    return () => {
      this.listeners.delete(listener);
    };
  }

  createOverlay(
    host: HTMLElement,
    context: ChartDOMOverlayContext
  ): ChartDOMOverlay {
    return this.fallback.createOverlay(host, context);
  }

  createIndicatorLabel(
    model: IndicatorLabelModel,
    actions: IndicatorLabelActions
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
    const modelStore = new ModelStore(model);
    const entry: ReactIndicatorLabelEntry = {
      key,
      root,
      component,
      actions,
      getModel: modelStore.getModel,
      subscribe: modelStore.subscribe,
    };
    this.labels.set(key, entry);
    applyIndicatorLabelModel(root, model);
    this.notify();

    let destroyed = false;
    return {
      root,
      update: (next) => {
        if (destroyed) return;
        applyIndicatorLabelModel(root, next);
        modelStore.update(next);
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        this.labels.delete(key);
        this.notify();
        root.remove();
      },
    };
  }

  createPaneDivider(
    model: PaneDividerModel,
    actions: PaneDividerActions
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
    const modelStore = new ModelStore(model);
    const entry: ReactPaneDividerEntry = {
      key,
      root,
      component: this.paneDivider,
      getModel: modelStore.getModel,
      subscribe: modelStore.subscribe,
    };
    this.dividers.set(key, entry);
    applyPaneDividerModel(root, model);
    this.notify();

    let destroyed = false;
    return {
      root,
      update: (next) => {
        if (destroyed) return;
        applyPaneDividerModel(root, next);
        modelStore.update(next);
      },
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        root.removeEventListener("pointerdown", onPointerDown);
        this.dividers.delete(key);
        this.notify();
        root.remove();
      },
    };
  }

  private resolveIndicatorLabel(
    labelKey: string
  ): IndicatorLabelRenderer | undefined {
    return this.indicatorLabels?.[labelKey] ?? this.defaultIndicatorLabel;
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

class ModelStore<T> implements ReactModelEntry<T> {
  private readonly listeners = new Set<Listener>();

  constructor(private model: T) {}

  readonly getModel = (): T => this.model;

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    listener();
    return () => {
      this.listeners.delete(listener);
    };
  };

  update(model: T): void {
    // Crosshair frames produce content-identical models with new identities;
    // keeping the old reference lets React skip re-rendering the portal.
    if (shallowModelsEqual(this.model, model)) return;
    this.model = model;
    for (const listener of this.listeners) listener();
  }
}

function shallowModelsEqual<T>(left: T, right: T): boolean {
  if (Object.is(left, right)) return true;
  if (
    typeof left !== "object" ||
    typeof right !== "object" ||
    left === null ||
    right === null
  ) {
    return false;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) =>
      Object.is(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key]
      )
    )
  );
}

function applyIndicatorLabelModel(
  root: HTMLElement,
  model: IndicatorLabelModel
): void {
  root.dataset.indicatorInstanceId = model.instanceId;
  root.dataset.indicatorType = model.typeId;
  root.dataset.indicatorLabelKey = model.labelKey;
  root.dataset.themeKey = model.themeKey;
}

function applyPaneDividerModel(
  root: HTMLElement,
  model: PaneDividerModel
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
