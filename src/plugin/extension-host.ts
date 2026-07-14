import {
  snapshotPriceAxisAnnotations,
  type PriceAxisAnnotation
} from "../annotations/price-axis-annotation";
import type {
  ChartOptionsChangeEvent,
  FinancialChart
} from "../chart/financial-chart";
import type { ChartEventMap } from "../chart/event-emitter";
import type { ChartData, TimeRange } from "../chart/types";
import type { Indicator } from "../indicators/indicator";
import type { PaneledIndicator } from "../indicators/paneled-indicator";
import type { ChartDOMAdapter } from "../ui/chart-dom-adapter";
import type {
  ChartContext,
  ChartPlugin,
  ChartPointerEvent
} from "./chart-plugin";

export interface IndicatorAttachmentHooks {
  mount(): void;
  unmount(): void;
  release(): void;
}

export class ExtensionHost {
  private indicators: readonly Indicator<any, any>[] = Object.freeze([]);
  private paneledIndicators: readonly PaneledIndicator<any, any>[] =
    Object.freeze([]);
  private plugins: readonly ChartPlugin[] = Object.freeze([]);
  private allIndicators: readonly Indicator<any, any>[] = Object.freeze([]);
  private lifecycleExtensions: readonly ChartPlugin[] = Object.freeze([]);
  private pointerExtensions: readonly ChartPlugin[] = Object.freeze([]);
  private readonly indicatorHooks = new WeakMap<
    Indicator<any, any>,
    IndicatorAttachmentHooks
  >();
  private readonly attachmentScopes = new WeakMap<
    ChartPlugin,
    AbortController
  >();
  private readonly priceAxisAnnotations = new Map<
    ChartPlugin,
    readonly PriceAxisAnnotation[]
  >();
  private disposed = false;

  constructor(
    private readonly chart: FinancialChart,
    private readonly domAdapter: ChartDOMAdapter
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
    return freezeSnapshot(
      this.allIndicators.filter(
        (indicator) => indicator.getIndicatorType() === typeId
      )
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

  isAttached(extension: ChartPlugin): boolean {
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

    this.plugins = freezeSnapshot([...this.plugins, plugin]);
    this.refreshOrderSnapshots();
    return this.attach(plugin);
  }

  removePlugin(plugin: ChartPlugin): boolean {
    if (!this.plugins.includes(plugin)) return false;

    this.plugins = freezeSnapshot(
      this.plugins.filter((item) => item !== plugin)
    );
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
      this.paneledIndicators = freezeSnapshot([
        ...this.paneledIndicators,
        indicator as PaneledIndicator<any, any>
      ]);
    } else {
      this.indicators = freezeSnapshot([...this.indicators, indicator]);
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
      this.paneledIndicators = freezeSnapshot(
        this.paneledIndicators.filter((item) => item !== indicator)
      );
    } else {
      this.indicators = freezeSnapshot(
        this.indicators.filter((item) => item !== indicator)
      );
    }
    this.refreshIndicatorSnapshots();
    this.detach(indicator);
    return true;
  }

  deliverCurrentState(
    extensions: readonly ChartPlugin[],
    optionsEvent: ChartOptionsChangeEvent = this.createInitialOptionsEvent()
  ): void {
    const data = this.chart.getData();
    const visibleRange = this.chart.getVisibleTimeRange();
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

    const indicators = [...this.allIndicators];
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
    this.indicators = Object.freeze([]);
    this.paneledIndicators = Object.freeze([]);
    this.plugins = Object.freeze([]);
    this.refreshIndicatorSnapshots();
    this.priceAxisAnnotations.clear();
    if (firstError !== undefined) throw firstError;
  }

  private attach(extension: ChartPlugin, mount?: () => void): boolean {
    const abortController = new AbortController();
    this.attachmentScopes.set(extension, abortController);
    let attached = false;
    try {
      extension.attach(this.createContext(extension, abortController.signal));
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

  private discardFailedAttachment(extension: ChartPlugin): void {
    const indicator = extension as Indicator<any, any>;
    const hooks = this.indicatorHooks.get(indicator);
    if (hooks) {
      if (
        this.paneledIndicators.includes(indicator as PaneledIndicator<any, any>)
      ) {
        this.paneledIndicators = freezeSnapshot(
          this.paneledIndicators.filter((item) => item !== indicator)
        );
      } else {
        this.indicators = freezeSnapshot(
          this.indicators.filter((item) => item !== indicator)
        );
      }
      this.refreshIndicatorSnapshots();
    } else {
      this.plugins = freezeSnapshot(
        this.plugins.filter((plugin) => plugin !== extension)
      );
      this.refreshOrderSnapshots();
    }
    this.disposeAttachmentScope(extension);
    hooks?.release();
    if (hooks) this.indicatorHooks.delete(indicator);
  }

  private detach(extension: ChartPlugin): void {
    this.disposeAttachmentScope(extension);
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

  private createContext(
    extension: ChartPlugin,
    signal: AbortSignal
  ): ChartContext {
    const scoped = (dispose: () => void) =>
      this.createScopedDisposer(signal, dispose);
    return {
      chart: this.chart,
      domAdapter: this.domAdapter,
      signal,
      emit: (event, data) => this.emitFromExtension(event, data),
      getCanvasContext: (layer) => this.chart.getContext(layer),
      getLogicalCanvas: (layer) => this.chart.getLogicalCanvas(layer),
      getPanes: () => this.chart.getPanes(),
      getPlugin: (key) => this.getPlugin(key),
      getPlugins: () => this.getPlugins(),
      getVisibleTimeWindow: () => this.chart.getVisibleTimeWindow(),
      getVisibleTimeRange: () => this.chart.getVisibleTimeRange(),
      on: (event, listener) => scoped(this.chart.on(event, listener)),
      onRenderStage: (stage, callback) =>
        scoped(this.chart.onRenderStage(stage, callback)),
      requestRedraw: (part, immediate) =>
        this.chart.requestRedraw(part, immediate),
      setPriceAxisAnnotations: (annotations) =>
        this.setPriceAxisAnnotations(extension, annotations),
      clearPriceAxisAnnotations: () =>
        this.setPriceAxisAnnotations(extension, []),
      setCrosshair: (options) => this.chart.setCrosshair(options),
      clearCrosshair: () => this.chart.clearCrosshair()
    };
  }

  private emitFromExtension<K extends keyof ChartEventMap>(
    event: K,
    data: ChartEventMap[K]
  ): void {
    if (event === "drawing-finished") {
      this.notifyDrawingFinished(data as ChartEventMap["drawing-finished"]);
    }
    this.chart.emit(event, data);
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

  private disposeAttachmentScope(extension: ChartPlugin): void {
    this.attachmentScopes.get(extension)?.abort();
    this.attachmentScopes.delete(extension);
    this.priceAxisAnnotations.delete(extension);
  }

  private setPriceAxisAnnotations(
    extension: ChartPlugin,
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
    this.chart.requestRedraw("annotations");
  }

  private deliverOptions(
    extension: ChartPlugin,
    event: ChartOptionsChangeEvent
  ): void {
    if (this.isIndicator(extension)) extension.applyChartOptions(event);
    if (this.isAttached(extension)) extension.onOptionsChanged?.(event);
  }

  private createInitialOptionsEvent(): ChartOptionsChangeEvent {
    const current = this.chart.getOptions();
    return Object.freeze({
      previous: current,
      current,
      changedKeys: Object.freeze([])
    });
  }

  private forEachLifecycleExtension(
    notify: (extension: ChartPlugin) => void
  ): void {
    const extensions = this.lifecycleExtensions;
    for (const extension of extensions) {
      if (this.isAttached(extension)) notify(extension);
    }
  }

  private isIndicator(
    extension: ChartPlugin
  ): extension is Indicator<any, any> {
    return this.allIndicators.includes(extension as Indicator<any, any>);
  }

  private refreshIndicatorSnapshots(): void {
    this.allIndicators = freezeSnapshot([
      ...this.indicators,
      ...this.paneledIndicators
    ]);
    this.refreshOrderSnapshots();
  }

  private refreshOrderSnapshots(): void {
    this.lifecycleExtensions = freezeSnapshot([
      ...this.indicators,
      ...this.paneledIndicators,
      ...this.plugins
    ]);
    const pointerExtensions: ChartPlugin[] = [];
    appendReversed(pointerExtensions, this.plugins);
    appendReversed(pointerExtensions, this.paneledIndicators);
    appendReversed(pointerExtensions, this.indicators);
    this.pointerExtensions = freezeSnapshot(pointerExtensions);
  }

  private assertActive(kind: "indicator" | "plugin"): void {
    if (this.disposed) {
      throw new Error(`Cannot add a ${kind} to a disposed chart.`);
    }
  }
}

function freezeSnapshot<T>(values: T[]): readonly T[] {
  return Object.freeze(values);
}

function appendReversed<T>(target: T[], values: readonly T[]): void {
  for (let index = values.length - 1; index >= 0; index--) {
    target.push(values[index]);
  }
}
