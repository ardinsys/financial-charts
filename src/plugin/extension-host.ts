import {
  snapshotPriceAxisAnnotations,
  type PriceAxisAnnotation
} from "../annotations/price-axis-annotation";
import type { ChartOptionsChangeEvent } from "../chart/chart-options";
import type {
  ChartEventMap,
  EventEmitter
} from "../chart/event-emitter";
import type { ChartData, TimeRange } from "../chart/types";
import type { ChartPaneState } from "../chart/chart-state";
import type { Indicator } from "../indicators/indicator";
import type { ChartIndicatorHost } from "../indicators/chart-indicator-host";
import type { PaneledIndicator } from "../indicators/paneled-indicator";
import type { ChartRenderer } from "../render/chart-renderer";
import type {
  ChartCrosshairOptions,
  ChartCrosshairState
} from "../interaction/crosshair";
import type { ChartDOMAdapter } from "../ui/chart-dom-adapter";
import type { ChartExtensionReadModel } from "./chart-extension-read-model";
import type {
  ChartExtension,
  ChartPlugin,
  ChartPointerEvent,
  ExtensionContext
} from "./chart-plugin";

type HostedExtension = ChartPlugin | Indicator<any, any>;

export interface ChartExtensionCommands {
  getCrosshairState(): ChartCrosshairState | undefined;
  getPaneHeightRatios(): readonly ChartPaneState[];
  setCrosshair(
    options: ChartCrosshairOptions
  ): ChartCrosshairState | undefined;
  clearCrosshair(): void;
  setPaneHeightRatios(panes: readonly ChartPaneState[]): void;
  setVisibleTimeWindow(range: TimeRange): void;
  addIndicator(indicator: Indicator<any, any>): void;
  removeIndicator(indicator: Indicator<any, any>): void;
  removeExtension(extension: ChartExtension): void;
}

export interface IndicatorAttachmentHooks {
  mount(): void;
  unmount(): void;
  release(): void;
}

export class ExtensionHost {
  private indicators: readonly Indicator<any, any>[] = [];
  private paneledIndicators: readonly PaneledIndicator<any, any>[] = [];
  private plugins: readonly ChartPlugin[] = [];
  private allIndicators: readonly Indicator<any, any>[] = [];
  private lifecycleExtensions: readonly ChartExtension[] = [];
  private pointerExtensions: readonly ChartExtension[] = [];
  private readonly indicatorHooks = new WeakMap<
    Indicator<any, any>,
    IndicatorAttachmentHooks
  >();
  private readonly attachmentScopes = new WeakMap<
    ChartExtension,
    AbortController
  >();
  private readonly priceAxisAnnotations = new Map<
    ChartExtension,
    readonly PriceAxisAnnotation[]
  >();
  private disposed = false;

  constructor(
    private readonly events: EventEmitter<ChartEventMap>,
    private readonly commands: ChartExtensionCommands,
    private readonly domAdapter: ChartDOMAdapter,
    private readonly renderer: ChartRenderer,
    private readonly hostElement: HTMLElement,
    private readonly readModel: ChartExtensionReadModel,
    private readonly indicatorHost: ChartIndicatorHost
  ) {}

  getIndicators(): readonly Indicator<any, any>[] {
    return this.indicators;
  }

  getPaneledIndicators(): readonly PaneledIndicator<any, any>[] {
    return this.paneledIndicators;
  }

  getAllIndicators(): readonly Indicator<any, any>[] {
    return this.allIndicators;
  }

  getIndicatorById(instanceId: string): Indicator<any, any> | undefined {
    return this.allIndicators.find(
      (indicator) => indicator.getInstanceId() === instanceId
    );
  }

  getIndicatorsByType(typeId: string): readonly Indicator<any, any>[] {
    return this.allIndicators.filter(
      (indicator) => indicator.getIndicatorType() === typeId
    );
  }

  getPlugins(): readonly ChartPlugin[] {
    return this.plugins;
  }

  getPlugin<TPlugin extends ChartPlugin = ChartPlugin>(
    key: string
  ): TPlugin | undefined {
    return this.plugins.find((plugin) => plugin.key === key) as
      | TPlugin
      | undefined;
  }

  isAttached(extension: ChartExtension): boolean {
    return this.lifecycleExtensions.includes(extension);
  }

  addPlugin(plugin: ChartPlugin): boolean {
    this.assertActive("plugin");
    if (this.plugins.includes(plugin)) {
      throw new Error("Plugin instance is already attached to this chart.");
    }
    if (this.plugins.some((item) => item.key === plugin.key)) {
      throw new Error(
        `Plugin key "${plugin.key}" is already registered on this chart.`
      );
    }

    this.plugins = [...this.plugins, plugin];
    this.refreshOrderSnapshots();
    return this.attach(plugin);
  }

  removePlugin(plugin: ChartPlugin): boolean {
    if (!this.plugins.includes(plugin)) return false;

    this.plugins = this.plugins.filter((item) => item !== plugin);
    this.refreshOrderSnapshots();
    this.detach(plugin);
    return true;
  }

  addIndicator(
    indicator: Indicator<any, any>,
    paneled: boolean,
    hooks: IndicatorAttachmentHooks
  ): boolean {
    this.assertActive("indicator");
    if (this.allIndicators.includes(indicator)) {
      throw new Error("Indicator instance is already attached to this chart.");
    }
    if (this.getIndicatorById(indicator.getInstanceId())) {
      throw new Error(
        `Indicator instanceId "${indicator.getInstanceId()}" is already attached to this chart.`
      );
    }

    this.indicatorHooks.set(indicator, hooks);
    if (paneled) {
      this.paneledIndicators = [
        ...this.paneledIndicators,
        indicator as PaneledIndicator<any, any>
      ];
    } else {
      this.indicators = [...this.indicators, indicator];
    }
    this.refreshIndicatorSnapshots();
    return this.attach(indicator, hooks.mount);
  }

  removeIndicator(indicator: Indicator<any, any>): boolean {
    const paneled = this.paneledIndicators.includes(
      indicator as PaneledIndicator<any, any>
    );
    if (!paneled && !this.indicators.includes(indicator)) return false;

    if (paneled) {
      this.paneledIndicators = this.paneledIndicators.filter(
        (item) => item !== indicator
      );
    } else {
      this.indicators = this.indicators.filter((item) => item !== indicator);
    }
    this.refreshIndicatorSnapshots();
    this.detach(indicator);
    return true;
  }

  deliverCurrentState(
    extensions: readonly ChartExtension[],
    optionsEvent: ChartOptionsChangeEvent = this.createInitialOptionsEvent()
  ): void {
    const data = this.readModel.getData();
    const visibleRange = this.readModel.getVisibleTimeRange();
    for (const extension of extensions) {
      if (!this.isAttached(extension)) continue;
      this.deliverOptions(extension, optionsEvent);
      if (!this.isAttached(extension)) continue;
      extension.onData?.(data);
      if (!this.isAttached(extension)) continue;
      extension.onVisibleRangeChanged?.(visibleRange);
    }
  }

  notifyOptionsChanged(event: ChartOptionsChangeEvent): void {
    this.forEachLifecycleExtension((extension) => {
      this.deliverOptions(extension, event);
    });
  }

  notifyData(data: readonly ChartData[]): void {
    this.forEachLifecycleExtension((extension) => {
      extension.onData?.(data);
    });
  }

  notifyVisibleRangeChanged(range: TimeRange): void {
    this.forEachLifecycleExtension((extension) => {
      extension.onVisibleRangeChanged?.(range);
    });
  }

  notifyPaneHeightsChanged(panes: readonly ChartPaneState[]): void {
    this.forEachLifecycleExtension((extension) => {
      extension.onPaneHeightsChanged?.(panes);
    });
  }

  notifyPointer(event: ChartPointerEvent): boolean {
    for (const extension of this.pointerExtensions) {
      if (!this.isAttached(extension)) continue;
      if (extension.onPointer?.(event) === true) return true;
    }
    return false;
  }

  notifyDrawingFinished(event: ChartEventMap["drawing-finished"]): void {
    this.forEachLifecycleExtension((extension) => {
      extension.onDrawingFinished?.(event);
    });
  }

  beforeDrawPlugins(): void {
    for (const plugin of this.plugins) plugin.beforeDraw?.();
  }

  drawPlugins(): void {
    for (const plugin of this.plugins) plugin.draw?.();
  }

  afterDrawPlugins(): void {
    for (const plugin of this.plugins) plugin.afterDraw?.();
  }

  hasPriceAxisAnnotations(): boolean {
    return this.priceAxisAnnotations.size > 0;
  }

  *getPriceAxisAnnotations(): IterableIterator<PriceAxisAnnotation> {
    for (const extension of this.lifecycleExtensions) {
      const annotations = this.priceAxisAnnotations.get(extension);
      if (annotations) yield* annotations;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    const indicators = [...this.allIndicators].reverse();
    const plugins = [...this.plugins].reverse();
    let firstError: unknown;
    // Detach hooks may persist final chart state, so registries stay readable
    // until every extension has observed detachment.
    for (const indicator of indicators) {
      try {
        this.detach(indicator);
      } catch (error) {
        firstError ??= error;
      }
    }
    for (const plugin of plugins) {
      try {
        this.detach(plugin);
      } catch (error) {
        firstError ??= error;
      }
    }
    this.indicators = [];
    this.paneledIndicators = [];
    this.plugins = [];
    this.refreshIndicatorSnapshots();
    this.priceAxisAnnotations.clear();
    if (firstError !== undefined) throw firstError;
  }

  private attach(extension: HostedExtension, mount?: () => void): boolean {
    const abortController = new AbortController();
    this.attachmentScopes.set(extension, abortController);
    let attached = false;
    try {
      const context = this.createExtensionContext(
        extension,
        abortController.signal
      );
      if (this.isIndicator(extension)) {
        extension.attach(this.indicatorHost.createContext(extension, context));
      } else {
        extension.attach({
          ...context,
          getCrosshairState: () => this.commands.getCrosshairState(),
          getVisibleLogicalRange: () =>
            this.readModel.getVisibleLogicalRange(),
          getPaneHeightRatios: () => this.commands.getPaneHeightRatios(),
          setPaneHeightRatios: (panes) =>
            this.commands.setPaneHeightRatios(panes),
          setVisibleTimeWindow: (range) =>
            this.commands.setVisibleTimeWindow(range),
          getIndicators: () => this.getAllIndicators(),
          getIndicatorById: (instanceId) =>
            this.getIndicatorById(instanceId),
          addIndicator: (indicator) => this.commands.addIndicator(indicator),
          removeIndicator: (indicator) =>
            this.commands.removeIndicator(indicator)
        });
      }
      attached = true;
      if (!this.isAttached(extension)) return false;
      mount?.();
      if (!this.isAttached(extension)) return false;
      this.deliverCurrentState([extension]);
      return this.isAttached(extension);
    } catch (error) {
      try {
        if (this.isAttached(extension)) {
          if (!attached) {
            this.discardFailedAttachment(extension);
          } else if (this.isIndicator(extension)) {
            this.removeIndicator(extension);
          } else {
            this.removePlugin(extension);
          }
        } else {
          this.disposeAttachmentScope(extension);
        }
      } finally {
        throw error;
      }
    }
  }

  private discardFailedAttachment(extension: HostedExtension): void {
    const indicator = extension as Indicator<any, any>;
    const hooks = this.indicatorHooks.get(indicator);
    if (hooks) {
      if (
        this.paneledIndicators.includes(indicator as PaneledIndicator<any, any>)
      ) {
        this.paneledIndicators = this.paneledIndicators.filter(
          (item) => item !== indicator
        );
      } else {
        this.indicators = this.indicators.filter(
          (item) => item !== indicator
        );
      }
      this.refreshIndicatorSnapshots();
    } else {
      this.plugins = this.plugins.filter((plugin) => plugin !== extension);
      this.refreshOrderSnapshots();
    }
    this.disposeAttachmentScope(extension);
    hooks?.release();
    if (hooks) this.indicatorHooks.delete(indicator);
  }

  private detach(extension: HostedExtension): void {
    if (!this.disposeAttachmentScope(extension)) return;
    const indicator = extension as Indicator<any, any>;
    const hooks = this.indicatorHooks.get(indicator);
    try {
      extension.detach?.();
    } finally {
      try {
        hooks?.unmount();
      } finally {
        hooks?.release();
        if (hooks) this.indicatorHooks.delete(indicator);
      }
    }
  }

  private createExtensionContext(
    extension: ChartExtension,
    signal: AbortSignal
  ): ExtensionContext {
    const scoped = (dispose: () => void) =>
      this.createScopedDisposer(signal, dispose);
    return {
      domAdapter: this.domAdapter,
      hostElement: this.hostElement,
      signal,
      emit: (event, data) => this.emitFromExtension(event, data),
      getData: () => this.readModel.getData(),
      getOptions: () => this.readModel.getOptions(),
      getCanvasContext: (layer) => this.renderer.getContext(layer),
      getLogicalCanvas: (layer) => this.renderer.getLogicalSize(layer),
      getPanes: () => this.readModel.getPanes(),
      getPlugin: (key) => this.getPlugin(key),
      getPlugins: () => this.getPlugins(),
      getVisibleTimeWindow: () => this.readModel.getVisibleTimeWindow(),
      getVisibleTimeRange: () => this.readModel.getVisibleTimeRange(),
      on: (event, listener) => scoped(this.events.on(event, listener)),
      onRenderStage: (stage, callback) =>
        scoped(this.renderer.onRenderStage(stage, callback)),
      requestRedraw: (part, immediate) =>
        this.renderer.requestRedraw(part, immediate),
      setPriceAxisAnnotations: (annotations) =>
        this.setPriceAxisAnnotations(extension, annotations),
      clearPriceAxisAnnotations: () =>
        this.setPriceAxisAnnotations(extension, []),
      setCrosshair: (options) => this.commands.setCrosshair(options),
      clearCrosshair: () => this.commands.clearCrosshair(),
      remove: () => {
        if (!signal.aborted) this.commands.removeExtension(extension);
      }
    };
  }

  private emitFromExtension<K extends keyof ChartEventMap>(
    event: K,
    data: ChartEventMap[K]
  ): void {
    if (event === "drawing-finished") {
      this.notifyDrawingFinished(data as ChartEventMap["drawing-finished"]);
    }
    this.events.emit(event, data);
  }

  private createScopedDisposer(
    signal: AbortSignal,
    dispose: () => void
  ): () => void {
    let active = true;
    const scopedDispose = () => {
      if (!active) return;
      active = false;
      signal.removeEventListener("abort", scopedDispose);
      dispose();
    };
    signal.addEventListener("abort", scopedDispose, { once: true });
    if (signal.aborted) scopedDispose();
    return scopedDispose;
  }

  private disposeAttachmentScope(extension: ChartExtension): boolean {
    const scope = this.attachmentScopes.get(extension);
    if (!scope) return false;
    scope.abort();
    this.attachmentScopes.delete(extension);
    this.priceAxisAnnotations.delete(extension);
    return true;
  }

  private setPriceAxisAnnotations(
    extension: ChartExtension,
    annotations: readonly PriceAxisAnnotation[]
  ): void {
    const scope = this.attachmentScopes.get(extension);
    if (!scope || scope.signal.aborted) return;

    const snapshot = snapshotPriceAxisAnnotations(annotations);
    if (snapshot.length === 0) {
      if (!this.priceAxisAnnotations.delete(extension)) return;
    } else {
      this.priceAxisAnnotations.set(extension, snapshot);
    }
    this.renderer.requestRedraw("annotations");
  }

  private deliverOptions(
    extension: ChartExtension,
    event: ChartOptionsChangeEvent
  ): void {
    if (this.isIndicator(extension)) extension.applyChartOptions(event);
    if (this.isAttached(extension)) extension.onOptionsChanged?.(event);
  }

  private createInitialOptionsEvent(): ChartOptionsChangeEvent {
    const current = this.readModel.getOptions();
    return {
      previous: current,
      current,
      changedKeys: []
    };
  }

  private forEachLifecycleExtension(
    notify: (extension: ChartExtension) => void
  ): void {
    const extensions = this.lifecycleExtensions;
    for (const extension of extensions) {
      if (this.isAttached(extension)) notify(extension);
    }
  }

  private isIndicator(
    extension: ChartExtension
  ): extension is Indicator<any, any> {
    return this.allIndicators.includes(extension as Indicator<any, any>);
  }

  private refreshIndicatorSnapshots(): void {
    this.allIndicators = [
      ...this.indicators,
      ...this.paneledIndicators
    ];
    this.refreshOrderSnapshots();
  }

  private refreshOrderSnapshots(): void {
    this.lifecycleExtensions = [
      ...this.indicators,
      ...this.paneledIndicators,
      ...this.plugins
    ];
    const pointerExtensions: ChartExtension[] = [];
    appendReversed(pointerExtensions, this.plugins);
    appendReversed(pointerExtensions, this.paneledIndicators);
    appendReversed(pointerExtensions, this.indicators);
    this.pointerExtensions = pointerExtensions;
  }

  private assertActive(kind: "indicator" | "plugin"): void {
    if (this.disposed) {
      throw new Error(`Cannot add a ${kind} to a disposed chart.`);
    }
  }
}

function appendReversed<T>(target: T[], values: readonly T[]): void {
  for (let index = values.length - 1; index >= 0; index--) {
    target.push(values[index]);
  }
}
