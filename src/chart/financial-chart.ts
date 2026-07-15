import { ChartController } from "../controllers/controller";
import type { PaneledIndicator } from "../indicators/paneled-indicator";
import {
  Indicator,
  restoreIndicator,
  type IndicatorInvalidationOptions,
  type IndicatorMutationOptions
} from "../indicators/indicator";
import type { ScaleRangeModifier } from "../scales/data-scale-model";
import type { BarAlignment, TimeScaleRange } from "../scales/time-scale";
import type { ChartTheme } from "./themes";
import { ChartData, TimeRange } from "./types";
import { EventEmitter } from "./event-emitter";
import { createPositionedContainer } from "../utils/dom";
import type { ChartDOMOverlay, ChartDOMAdapter } from "../ui/chart-dom-adapter";
import {
  type RenderCallback,
  type RenderLayer,
  type RenderStage
} from "../render/render-pipeline";
import type {
  ChartCanvasLayer,
  ChartRedrawPart
} from "../render/chart-render-types";
import { ChartRenderer } from "../render/chart-renderer";
import { Pane } from "../panes/pane";
import {
  PaneLayout,
  type PaneHeightsInput
} from "../panes/pane-layout";
import type { ChartPlugin, ChartPointerEvent } from "../plugin/chart-plugin";
import { ExtensionHost } from "../plugin/extension-host";
import { InteractionController } from "../interaction/interaction-controller";
import { CrosshairResolver } from "../interaction/crosshair-resolver";
import type {
  ChartCrosshairOptions,
  ChartCrosshairState
} from "../interaction/crosshair";
import { getDefaultControllerConstructors } from "./internal-default-controllers";
import { ChartModel } from "./chart-model";
import { ChartOptionsState } from "./chart-options-state";
import { ControllerRegistry } from "./controller-registry";
import {
  type ChartLocalizationOptions,
  type ChartOptions,
  type ChartOptionsChangeEvent,
  type ChartOptionsSnapshot,
  type ChartOptionsUpdate,
  type ControllerConstructor,
  type ControllerType,
  type LocaleValuesMap,
  type MutableResolvedChartOptions
} from "./chart-options";
import {
  createChartState,
  indexStateContributors,
  type ChartPaneState,
  type ChartState,
  type ChartStateContributor,
  type ChartStateRestoreOptions,
  type ChartStateSerializationOptions,
  validateChartState
} from "./chart-state";

export type {
  ChartLocalizationOptions,
  ChartOptionKey,
  ChartOptions,
  ChartOptionsChangeEvent,
  ChartOptionsSnapshot,
  ChartOptionsUpdate,
  ControllerConstructor,
  ControllerID,
  ControllerType,
  LocaleValues,
  LocaleValuesMap,
  ResolvedChartOptions
} from "./chart-options";
export {
  CHART_STATE_VERSION,
  type ChartCoreState,
  type ChartPaneState,
  type ChartState,
  type ChartStateContributor,
  type ChartStateRestoreOptions,
  type ChartStateRestoredEvent,
  type ChartStateSerializationOptions
} from "./chart-state";
export type {
  ChartCrosshairOptions,
  ChartCrosshairState
} from "../interaction/crosshair";
export type {
  ChartCanvasLayer,
  ChartRedrawPart
} from "../render/chart-render-types";
export type { IndicatorMutationOptions } from "../indicators/indicator";

export type { PaneHeightsInput } from "../panes/pane-layout";

interface ChartChange {
  data?: readonly ChartData[];
  visibleRange?: TimeRange;
  options?: ChartOptionsChangeEvent;
  crosshairCleared?: boolean;
  redraw?: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>;
  immediate?: boolean;
}

export class FinancialChart extends EventEmitter {
  private readonly controllerRegistry: ControllerRegistry;
  private controller: ChartController;
  protected outsideContainer: HTMLElement;
  protected container: HTMLElement;
  protected indicatorLabelContainer: HTMLElement;
  private readonly model = new ChartModel();
  private readonly optionsState!: ChartOptionsState;
  private domAdapter: ChartDOMAdapter;
  private overlay!: ChartDOMOverlay;
  private readonly renderer: ChartRenderer;
  private readonly paneLayout: PaneLayout;
  private readonly crosshairResolver: CrosshairResolver;
  private readonly interactionController: InteractionController;
  private pendingRestoredVisibleRange?: TimeRange;

  private readonly extensionHost: ExtensionHost;
  private disposed = false;

  protected yLabelWidth = 80;
  protected xLabelHeight = 30;
  private readonly controllerRedrawParts: readonly RenderLayer[] = [
    "grid",
    "axes",
    "series"
  ];
  private readonly allRedrawParts: readonly RenderLayer[] = [
    "grid",
    "axes",
    "series",
    "indicators",
    "drawings",
    "annotations",
    "crosshair"
  ];
  private readonly viewRedrawParts: readonly RenderLayer[] = [
    "grid",
    "axes",
    "series",
    "indicators",
    "drawings",
    "annotations",
    "crosshair"
  ];

  private get options(): MutableResolvedChartOptions {
    return this.optionsState.getResolved();
  }


  public registerController(controllerClass: ControllerConstructor) {
    if (this.controllerRegistry.register(controllerClass)) {
      this.syncRegisteredControllers();
    }
  }

  public registerDefaults() {
    if (this.controllerRegistry.registerDefaults()) {
      this.syncRegisteredControllers();
    }
  }

  private registerConstructorOptions(
    options: ChartOptions,
    includeDefaultControllers: boolean
  ) {
    if (includeDefaultControllers) {
      this.registerDefaults();
    }
    for (const controller of options.controllers ?? []) {
      this.registerController(controller);
    }
  }

  private syncRegisteredControllers() {
    if (!this.optionsState) return;
    this.optionsState.setControllers(this.controllerRegistry.getSnapshot());
  }

  private getControllerClass(type: ControllerType) {
    return this.controllerRegistry.get(type);
  }

  getYLabelWidth() {
    return this.yLabelWidth;
  }

  getTimeRange() {
    return this.model.getTimeRange();
  }

  getVisibleScale() {
    return this.model.getVisibleScale();
  }

  getTimeScale() {
    return this.model.getTimeScale();
  }

  getPriceScale() {
    return this.getMainPane().getPriceScale();
  }

  getVolumeScale() {
    return this.model.getVolumeScale();
  }

  /** Returns the precise fractional logical-index window. */
  getVisibleLogicalRange(): TimeScaleRange {
    return this.model.getVisibleIndexRange();
  }

  getController() {
    return this.controller;
  }

  getTimeAnchorAlignment(): BarAlignment {
    return this.controller.getTimeAnchorAlignment();
  }

  getOptions(): ChartOptionsSnapshot {
    return this.optionsState.getSnapshot();
  }

  /** Returns versioned, JSON-safe state without chart data or presentation. */
  public toJSON(options: ChartStateSerializationOptions = {}): ChartState {
    const configuredTimeRange = this.options.timeRange;
    return createChartState(
      {
        core: {
          type: this.options.type,
          timeRange:
            configuredTimeRange === "auto"
              ? "auto"
              : { ...configuredTimeRange },
          stepSize: this.options.stepSize,
          maxZoom: this.options.maxZoom,
          volume: this.options.volume
        },
        visibleRange: {
          ...(this.pendingRestoredVisibleRange ?? this.getVisibleTimeWindow())
        },
        panes: this.getPanes().map((pane) => {
          const indicator = this.paneLayout.getIndicatorForPane(pane);
          return {
            id: pane.getId(),
            height: this.paneLayout.getPaneHeight(pane),
            ...(indicator
              ? { indicatorInstanceId: indicator.getInstanceId() }
              : {})
          };
        }),
        indicators: this.getAllIndicators().map((indicator) =>
          indicator.toJSON()
        )
      },
      options.contributors ?? []
    );
  }

  /** Restores validated state and emits one `state-restored` event. */
  public restoreState(
    state: unknown,
    options: ChartStateRestoreOptions = {}
  ): void {
    if (this.disposed) {
      throw new Error("Cannot restore state into a disposed chart.");
    }

    const validatedState = validateChartState(state);
    this.getControllerClass(validatedState.core.type);

    if (validatedState.indicators.length > 0 && !options.indicatorResolver) {
      throw new Error(
        "Chart state contains indicators but no indicatorResolver was provided."
      );
    }
    const restoredIndicators = validatedState.indicators.map((indicatorState) =>
      restoreIndicator(indicatorState, options.indicatorResolver!)
    );
    const instanceIds = new Set<string>();
    for (const indicator of restoredIndicators) {
      const instanceId = indicator.getInstanceId();
      if (instanceIds.has(instanceId)) {
        throw new Error(
          `Chart state contains duplicate indicator instanceId "${instanceId}".`
        );
      }
      instanceIds.add(instanceId);
    }

    const paneIdsByIndicator = this.validateRestoredPanes(
      validatedState.panes,
      restoredIndicators
    );
    const contributors = indexStateContributors(options.contributors ?? []);
    const restoredContributors: ChartStateContributor[] = [];
    for (const key of Object.keys(validatedState.contributions ?? {})) {
      const contributor = contributors.get(key);
      if (!contributor) {
        throw new Error(
          `Chart state contribution "${key}" has no matching contributor.`
        );
      }
      restoredContributors.push(contributor);
    }

    let optionsEvent: ChartOptionsChangeEvent | undefined;
    this.renderer.setPaused(true);
    this.paneLayout.setRestoredPaneIds(paneIdsByIndicator);
    try {
      for (const indicator of this.getAllIndicators()) {
        this.removeIndicator(indicator, { emit: false });
      }

      optionsEvent = this.applyOptionsUpdate(validatedState.core)?.options;

      if (this.model.hasData()) {
        this.updateVisibleIndexRange(
          this.resolveVisibleTimeWindow(validatedState.visibleRange)
        );
        this.pendingRestoredVisibleRange = undefined;
      } else {
        this.pendingRestoredVisibleRange = {
          ...validatedState.visibleRange
        };
      }

      for (const indicator of restoredIndicators) {
        this.addIndicator(indicator, { emit: false });
      }

      this.setPaneHeights(
        Object.fromEntries(
          validatedState.panes.map(({ id, height }) => [id, height])
        )
      );

      for (const contributor of restoredContributors) {
        contributor.fromJSON(validatedState.contributions![contributor.key]);
      }

      if (this.model.hasData()) {
        this.recalculateVisibleScale();
      }
      this.extensionHost.deliverCurrentState(this.getPlugins(), optionsEvent);
    } finally {
      this.paneLayout.setRestoredPaneIds();
      this.renderer.setPaused(false);
      this.requestRedraw(this.allRedrawParts);
    }

    this.emit("state-restored", {
      state: this.toJSON({ contributors: restoredContributors })
    });
  }

  /** Returns the stable frozen snapshot for the current mapped dataset. */
  getData(): readonly ChartData[] {
    return this.model.getData();
  }

  private syncPaneTimeScales() {
    const timeAnchorAlignment = this.getTimeAnchorAlignment();
    for (const pane of this.getPanes()) {
      pane.setTimeScale(this.model.getTimeScale());
      pane.setTimeAnchorAlignment(timeAnchorAlignment);
    }
  }

  private syncMainPanePriceScale() {
    this.getMainPane().setPriceRange(
      this.model.getVisibleScale().getYMin(),
      this.model.getVisibleScale().getYMax()
    );
  }

  private getMinimumVisibleIndexSlots() {
    const proportionalFactor = 1 / 50;
    const width = Math.max(this.getDrawingSize().width, 1);
    let dynamicStepWidth = width * proportionalFactor;
    dynamicStepWidth = Math.max(15, Math.min(30, dynamicStepWidth));
    return Math.max(1, Math.floor(width / dynamicStepWidth));
  }

  private getIndexBoundsSpan() {
    return this.model.getIndexBoundsSpan();
  }

  private getVisibleIndexSpan() {
    return this.model.getVisibleIndexSpan();
  }

  getPixelsPerBar() {
    return this.getDrawingSize().width / this.getVisibleIndexSpan();
  }

  private isPinnedToRightEdge() {
    return this.model.isPinnedToRightEdge();
  }

  private resetVisibleIndexRange() {
    return this.refreshIndexBounds({ reset: true });
  }

  private refreshIndexBounds(
    options: {
      reset?: boolean;
      preserveRightEdge?: boolean;
      span?: number;
    } = {}
  ) {
    const changed = this.model.refreshIndexBounds({
      ...options,
      minimumVisibleSlots: this.getMinimumVisibleIndexSlots()
    });
    this.syncPaneTimeScales();
    return changed;
  }

  /**
   * Sets the precise fractional logical-index window.
   * The range is clamped to the chart's index bounds with a minimum one-bar
   * span.
   * This is a no-op while the chart has no data.
   *
   * @throws {RangeError} when either boundary is not finite
   */
  public setVisibleIndexRange(range: TimeScaleRange): void {
    if (!this.model.hasData()) return;
    this.applyVisibleIndexRange(range);
  }

  /**
   * Selects whole bars whose timestamps fall in `[start, end)`.
   * This is a no-op while the chart has no data.
   *
   * @throws {RangeError} when either boundary is not finite
   */
  public setVisibleTimeRange(range: TimeRange): void {
    if (!this.model.hasData()) return;
    this.setVisibleIndexRange(this.model.logicalRangeForTimeRange(range));
  }

  /**
   * Sets a precise timestamp window while preserving fractional bar indexes.
   * This is a no-op while the chart has no data.
   *
   * @throws {RangeError} when either boundary is not finite
   */
  public setVisibleTimeWindow(range: TimeRange): void {
    if (!this.model.hasData()) return;
    this.setVisibleIndexRange(this.resolveVisibleTimeWindow(range));
  }

  private resolveVisibleTimeWindow(range: TimeRange): TimeScaleRange {
    return this.model.logicalRangeForTimeWindow(
      range,
      this.options.stepSize,
      this.controller.getBarAlignment()
    );
  }

  private applyVisibleIndexRange(range: TimeScaleRange): boolean {
    const changed = this.updateVisibleIndexRange(range);
    if (!changed) return false;

    this.recalculateVisibleScale();
    this.commitChange({
      visibleRange: this.getVisibleTimeRange(),
      redraw: this.viewRedrawParts
    });
    return true;
  }

  private updateVisibleIndexRange(range: TimeScaleRange): boolean {
    const changed = this.model.setVisibleIndexRange(range);
    this.syncPaneTimeScales();
    return changed;
  }

  private panInteractionByPixels(dx: number): void {
    const pixelsPerBar = this.getPixelsPerBar();
    if (pixelsPerBar <= 0) return;

    const delta = dx / pixelsPerBar;
    const visibleRange = this.model.getVisibleIndexRange();
    this.setVisibleIndexRange({
      from: visibleRange.from - delta,
      to: visibleRange.to - delta
    });
  }

  private zoomInteractionAtPixel(zoomFactor: number, pixel: number): void {
    const width = Math.max(this.getDrawingSize().width, 1);
    const boundsSpan = this.getIndexBoundsSpan();
    const oldSpan = this.getVisibleIndexSpan();
    const minSpan = Math.max(1, boundsSpan / this.options.maxZoom);
    const newSpan = Math.max(
      minSpan,
      Math.min(boundsSpan, oldSpan / zoomFactor)
    );
    const anchorRatio = Math.max(0, Math.min(1, pixel / width));
    const anchorIndex =
      this.model.getVisibleIndexRange().from + anchorRatio * oldSpan;
    const from = anchorIndex - anchorRatio * newSpan;

    this.setVisibleIndexRange({ from, to: from + newSpan });
  }

  getTheme() {
    return this.options.theme;
  }

  getIndicators(): readonly Indicator<any, any>[] {
    return this.extensionHost.getIndicators();
  }

  getPaneledIndicators(): readonly PaneledIndicator<any, any>[] {
    return this.extensionHost.getPaneledIndicators();
  }

  getAllIndicators(): readonly Indicator<any, any>[] {
    return this.extensionHost.getAllIndicators();
  }

  /** Returns an attached indicator by its unique instance identity. */
  getIndicatorById(instanceId: string): Indicator<any, any> | undefined {
    return this.extensionHost.getIndicatorById(instanceId);
  }

  /** Returns all attached indicators sharing a factory/type identity. */
  getIndicatorsByType(typeId: string): readonly Indicator<any, any>[] {
    return this.extensionHost.getIndicatorsByType(typeId);
  }

  getPanes(): readonly Pane[] {
    return this.paneLayout.getPanes();
  }

  getMainPane() {
    return this.paneLayout.getMainPane();
  }

  getPaneHeights(): Record<number, number> {
    return this.paneLayout.getPaneHeights();
  }

  setPaneHeights(heights: PaneHeightsInput): void {
    this.paneLayout.setPaneHeights(heights, this.getPaneLayoutHeight());
    this.applyPaneLayout({ redraw: true, immediate: true });
  }

  getPlugins(): readonly ChartPlugin[] {
    return this.extensionHost.getPlugins();
  }

  addPlugin(plugin: ChartPlugin): () => void {
    if (this.disposed) {
      throw new Error("Cannot add a plugin to a disposed chart.");
    }
    try {
      this.extensionHost.addPlugin(plugin);
    } finally {
      this.requestRedraw(this.allRedrawParts);
    }

    return () => {
      this.removePlugin(plugin);
    };
  }

  removePlugin(plugin: ChartPlugin): boolean {
    try {
      return this.extensionHost.removePlugin(plugin);
    } finally {
      this.requestRedraw(this.allRedrawParts);
    }
  }

  private commitChange(change: ChartChange) {
    if (change.options) {
      this.extensionHost.notifyOptionsChanged(change.options);
    }
    if (change.data) {
      this.extensionHost.notifyData(change.data);
    }
    if (change.visibleRange) {
      this.extensionHost.notifyVisibleRangeChanged(change.visibleRange);
    }
    if (change.options) {
      super.emit("options-change", change.options);
    }
    if (change.crosshairCleared) {
      super.emit("crosshair-clear", {});
    }
    const shouldRedraw = Array.isArray(change.redraw)
      ? change.redraw.length > 0
      : change.redraw !== undefined;
    if (change.redraw && shouldRedraw) {
      if (change.immediate) {
        this.requestRedraw(change.redraw, true);
      } else {
        this.requestRedraw(change.redraw);
      }
    }
  }

  private validateRestoredPanes(
    panes: readonly ChartPaneState[],
    indicators: readonly Indicator<any, any>[]
  ): ReadonlyMap<string, number> {
    const paneIdsByIndicator = new Map<string, number>();
    const indicatorsById = new Map(
      indicators.map((indicator) => [indicator.getInstanceId(), indicator])
    );
    let hasMainPane = false;

    for (const pane of panes) {
      if (pane.indicatorInstanceId === undefined) {
        if (pane.id !== this.getMainPane().getId() || hasMainPane) {
          throw new Error("Chart state must contain exactly one main pane.");
        }
        hasMainPane = true;
        continue;
      }

      const indicator = indicatorsById.get(pane.indicatorInstanceId);
      if (!indicator) {
        throw new Error(
          `Chart pane ${pane.id} references unknown indicator "${pane.indicatorInstanceId}".`
        );
      }
      if (!this.isPaneledIndicator(indicator)) {
        throw new Error(
          `Chart pane ${pane.id} references overlay indicator "${pane.indicatorInstanceId}".`
        );
      }
      if (paneIdsByIndicator.has(pane.indicatorInstanceId)) {
        throw new Error(
          `Chart state contains multiple panes for indicator "${pane.indicatorInstanceId}".`
        );
      }
      paneIdsByIndicator.set(pane.indicatorInstanceId, pane.id);
    }

    if (!hasMainPane) {
      throw new Error("Chart state must contain exactly one main pane.");
    }
    for (const indicator of indicators) {
      const instanceId = indicator.getInstanceId();
      if (
        this.isPaneledIndicator(indicator) &&
        !paneIdsByIndicator.has(instanceId)
      ) {
        throw new Error(
          `Chart state has no pane for indicator "${instanceId}".`
        );
      }
    }
    return paneIdsByIndicator;
  }

  private dispatchInteractionPointer(event: ChartPointerEvent): boolean {
    return this.extensionHost.notifyPointer(event);
  }

  private beforeDrawPlugins() {
    this.extensionHost.beforeDrawPlugins();
  }

  private drawPlugins() {
    this.extensionHost.drawPlugins();
  }

  private afterDrawPlugins() {
    this.extensionHost.afterDrawPlugins();
  }

  private isPaneledIndicator(
    indicator: Indicator<any, any>
  ): indicator is PaneledIndicator<any, any> {
    const candidate = indicator as {
      createScale?: unknown;
      getContainer?: unknown;
      getCrosshairValue?: unknown;
      init?: unknown;
      resize?: unknown;
    };

    return (
      typeof candidate.createScale === "function" &&
      typeof candidate.getContainer === "function" &&
      typeof candidate.getCrosshairValue === "function" &&
      typeof candidate.init === "function" &&
      typeof candidate.resize === "function"
    );
  }

  private getPaneLayoutHeight() {
    return Math.max(0, this.container.offsetHeight - this.xLabelHeight);
  }

  private applyPaneLayout({
    resizeCanvases = true,
    resizeIndicators = true,
    redraw = false,
    immediate = false
  }: {
    resizeCanvases?: boolean;
    resizeIndicators?: boolean;
    redraw?: boolean;
    immediate?: boolean;
  } = {}) {
    this.paneLayout.applyGeometry({
      width: Math.max(0, this.container.offsetWidth - this.yLabelWidth),
      height: this.getPaneLayoutHeight(),
      yAxisWidth: this.yLabelWidth,
      containerWidth: this.container.offsetWidth,
      themeKey: this.options.theme.key
    });

    if (resizeCanvases && this.renderer) this.renderer.resizeCanvases();
    if (resizeIndicators) this.paneLayout.resizeIndicators();
    if (redraw) this.requestRedraw(this.allRedrawParts, immediate);
  }

  private refreshIndicatorLabels(dataTime?: number) {
    for (const indicator of this.getPaneledIndicators()) {
      indicator.refreshLabel(dataTime);
    }
    for (const indicator of this.getIndicators()) {
      indicator.refreshLabel(dataTime);
    }
  }

  public onRenderStage(
    stage: RenderStage,
    callback: RenderCallback
  ): () => void {
    return this.renderer.onRenderStage(stage, callback);
  }

  public changeType(type: ControllerType) {
    this.updateOptions({ type });
  }

  getOutsideContainer() {
    return this.outsideContainer;
  }

  constructor(container: HTMLElement, options: ChartOptions) {
    super();
    const defaultControllerConstructors =
      getDefaultControllerConstructors(options);
    this.controllerRegistry = new ControllerRegistry(
      defaultControllerConstructors
    );
    const includeDefaultControllers =
      options.includeDefaultControllers ??
      defaultControllerConstructors.length > 0;
    this.registerConstructorOptions(options, includeDefaultControllers);
    this.optionsState = new ChartOptionsState(
      options,
      this.controllerRegistry.getSnapshot(),
      includeDefaultControllers
    );
    this.domAdapter = this.options.domAdapter;
    this.extensionHost = new ExtensionHost(this, this.domAdapter);

    this.outsideContainer = container;
    this.container = createPositionedContainer({
      position: "relative",
      overflow: "hidden",
      width: "100%",
      height: "100%",
      backgroundColor: this.options.theme.backgroundColor
    });
    this.container.classList.add(
      "financial-charts",
      `financial-charts-${this.options.theme.key}`
    );
    this.outsideContainer.appendChild(this.container);
    this.paneLayout = new PaneLayout(this.container, this.domAdapter, {
      mainPaneMinHeight: 80,
      indicatorPaneMinHeight: 50,
      dividerHeight: 8,
      onInteractiveResize: () =>
        this.applyPaneLayout({ redraw: true, immediate: true })
    });

    this.overlay = this.domAdapter.createOverlay(this.container, {
      themeKey: this.options.theme.key,
      labelTopOffset: this.options.theme.crosshair.infoLine.fontSize + 20
    });
    this.indicatorLabelContainer = this.overlay.indicatorLabelContainer;

    this.model.configureTimeRange(
      this.options.timeRange,
      this.options.stepSize,
      1
    );

    const ControllerClass = this.getControllerClass(this.options.type);

    this.controller = new ControllerClass(this, this.options);
    this.model.configureScales(
      (data, timeRange) =>
        this.controller.createDataScale(data, timeRange),
      this.controller.getBarAlignment()
    );
    this.applyPaneLayout({ resizeCanvases: false, resizeIndicators: false });
    this.renderer = new ChartRenderer(
      this.container,
      {
        getOptions: () => this.options,
        hasData: () => this.model.hasData(),
        getTimes: () => this.model.getTimes(),
        getVisibleData: () => this.model.getVisibleDataPoints(),
        getVisibleIndexRange: () => this.model.getVisibleIndexRange(),
        getTimeRange: () => this.model.getTimeRange(),
        getTimeScale: () => this.getTimeScale(),
        getVisibleScale: () => this.model.getVisibleScale(),
        getTimeAnchorAlignment: () => this.getTimeAnchorAlignment(),
        getPixelsPerBar: () => this.getPixelsPerBar(),
        getController: () => this.controller,
        getIndicators: () => this.getIndicators(),
        getPaneledIndicators: () => this.getPaneledIndicators(),
        getPanes: () => this.getPanes(),
        getMainPane: () => this.getMainPane(),
        getPaneIndicator: (pane) =>
          this.paneLayout.getIndicatorForPane(pane),
        getPriceAxisAnnotations: () =>
          this.extensionHost.getPriceAxisAnnotations(),
        getCrosshairState: () =>
          this.interactionController.getCrosshairState(),
        shouldDrawCrosshair: () =>
          this.interactionController.shouldDrawCrosshair(),
        refreshIndicatorLabels: (time) => this.refreshIndicatorLabels(time),
        beforeDraw: () => this.beforeDrawPlugins(),
        drawPlugins: () => this.drawPlugins(),
        afterDraw: () => this.afterDrawPlugins()
      },
      {
        getLayout: () => {
          const region = this.getMainPane().getRegion();
          const yAxisRegion = this.getMainPane().getYAxisRegion();
          return {
            plotWidth: region.width,
            plotHeight: region.height,
            paneLayoutHeight: this.getPaneLayoutHeight(),
            yAxisWidth: yAxisRegion.width,
            yAxisHeight: yAxisRegion.height,
            fullWidth: this.container.offsetWidth,
            fullHeight: this.container.offsetHeight,
            xAxisHeight: this.xLabelHeight
          };
        },
        onResize: () => this.handleRendererResize()
      }
    );
    this.crosshairResolver = new CrosshairResolver(
      this.model,
      this.paneLayout,
      {
        normalizeTime: (point) =>
          this.controller.getTimeFromRawDataPoint(point),
        getMainCanvas: () => this.renderer.getCanvas("main"),
        getDrawingWidth: () => this.renderer.getDrawingSize().width,
        getPlotHeight: () =>
          this.container.offsetHeight - this.xLabelHeight,
        getTimeAnchorAlignment: () => this.getTimeAnchorAlignment()
      }
    );
    const topCanvas = this.renderer.getCanvas("crosshair");
    this.interactionController = new InteractionController(
      {
        hasData: () => this.model.hasData(),
        createPointerEvent: (type, x, y, source) =>
          this.crosshairResolver.createPointerEvent(type, x, y, source),
        dispatchPointer: (event) => this.dispatchInteractionPointer(event),
        resolveDataPoint: (x, y, scale) =>
          this.crosshairResolver.resolveDataPoint(x, y, scale),
        resolveCrosshair: (x, y) =>
          this.crosshairResolver.resolvePointer(x, y),
        panByPixels: (dx) => this.panInteractionByPixels(dx),
        zoomAtPixel: (factor, pixel) =>
          this.zoomInteractionAtPixel(factor, pixel),
        clearCrosshair: () => this.clearCrosshair(),
        crosshairChanged: (state) => {
          this.requestRedraw("crosshair");
          this.emit("crosshair-change", state);
        },
        click: (event, point) => this.emit("click", { event, point }),
        touchClick: (event, point) => this.emit("touch-click", { event, point })
      },
      this.container,
      topCanvas
    );
  }

  private handleRendererResize(): void {
    this.applyPaneLayout();
    this.indicatorLabelContainer.style.maxHeight =
      this.getLogicalCanvas("main").height -
      this.options.theme.crosshair.infoLine.fontSize -
      30 +
      "px";

    if (!this.model.hasData()) return;
    const preserveRightEdge = this.isPinnedToRightEdge();
    const span = this.getVisibleIndexSpan();
    if (this.model.isAutoTimeRange()) this.refreshAutoTimeRange(true);
    const rangeChanged = this.refreshIndexBounds({
      reset: span === this.getIndexBoundsSpan(),
      preserveRightEdge,
      span
    });
    if (rangeChanged) this.recalculateVisibleScale();
    this.commitChange({
      visibleRange: rangeChanged ? this.getVisibleTimeRange() : undefined,
      redraw: this.allRedrawParts,
      immediate: true
    });
  }

  public getLocaleValues() {
    return (
      this.options.localeValues[this.options.locale] ||
      this.options.localeValues.default
    );
  }

  private refreshAutoTimeRange(recalculateDataScale = false) {
    this.model.updateAutoTimeRange(
      this.options.stepSize,
      this.getMinimumVisibleIndexSlots()
    );
    if (recalculateDataScale) {
      this.model.recalculateDataScale();
    }
  }

  private resetViewInteractionState() {
    this.model.resetViewInteractionState();
    this.interactionController.reset();
  }

  private applyConfiguredTimeRange() {
    this.model.configureTimeRange(
      this.options.timeRange,
      this.options.stepSize,
      this.getMinimumVisibleIndexSlots()
    );
  }

  private rebuildScales(resetVisibleRange: boolean) {
    this.model.configureScales(
      (data, timeRange) =>
        this.controller.createDataScale(data, timeRange),
      this.controller.getBarAlignment()
    );
    if (resetVisibleRange) this.resetVisibleIndexRange();
    this.syncPaneTimeScales();
    if (this.model.hasData()) this.recalculateVisibleScale();
  }

  private applyThemeChrome(previousThemeKey: string) {
    this.container.classList.remove(`financial-charts-${previousThemeKey}`);
    this.container.classList.add(
      `financial-charts-${this.options.theme.key}`
    );
    this.container.style.backgroundColor = this.options.theme.backgroundColor;
    this.overlay.update({
      themeKey: this.options.theme.key,
      labelTopOffset: this.options.theme.crosshair.infoLine.fontSize + 20
    });
    this.paneLayout.updatePaneDividers(this.options.theme.key);
  }

  private refreshLocalizationLabels() {
    for (const indicator of this.getIndicators()) {
      indicator.refreshLabel();
    }
    for (const indicator of this.getPaneledIndicators()) {
      indicator.refreshLabel();
    }
  }

  /** Applies an options patch in one reset, remap, and redraw cycle. */
  public updateOptions(update: ChartOptionsUpdate): void {
    const change = this.applyOptionsUpdate(update);
    if (change) this.commitChange(change);
  }

  private applyOptionsUpdate(
    update: ChartOptionsUpdate
  ): ChartChange | undefined {
    const event = this.optionsState.applyUpdate(
      update,
      (type) => {
        this.getControllerClass(type);
      }
    );
    if (!event) return;

    const changed = new Set(event.changedKeys);
    const typeChanged = changed.has("type");
    const stepSizeChanged = changed.has("stepSize");
    const coreChanged = stepSizeChanged || changed.has("timeRange");
    const localizationChanged =
      changed.has("locale") ||
      changed.has("timeZone") ||
      changed.has("formatter") ||
      changed.has("localeValues");
    const previousThemeKey = event.previous.theme.key;

    if (typeChanged) {
      const ControllerClass = this.getControllerClass(this.options.type);
      this.controller = new ControllerClass(this, this.options);
    }

    if (coreChanged) {
      this.resetViewInteractionState();
      if (stepSizeChanged) {
        this.model.remapData(this.options.stepSize);
      }
      this.applyConfiguredTimeRange();
      this.rebuildScales(true);
    } else if (typeChanged) {
      this.rebuildScales(false);
    }

    if (changed.has("theme")) this.applyThemeChrome(previousThemeKey);
    if (localizationChanged) this.refreshLocalizationLabels();

    const redrawParts = new Set<RenderLayer>();
    const includeRedrawParts = (parts: readonly RenderLayer[]) => {
      for (const part of parts) redrawParts.add(part);
    };
    if (this.model.hasData()) {
      if (typeChanged || coreChanged || changed.has("theme")) {
        includeRedrawParts(this.allRedrawParts);
      }
      if (changed.has("volume")) {
        includeRedrawParts(["series", "crosshair"]);
      }
      if (localizationChanged) {
        includeRedrawParts([
          "axes",
          "indicators",
          "annotations",
          "crosshair"
        ]);
      }
    }
    if (
      this.extensionHost.hasPriceAxisAnnotations() &&
      (changed.has("theme") || localizationChanged)
    ) {
      redrawParts.add("annotations");
    }

    const hasData = this.model.hasData();
    return {
      options: event,
      data:
        hasData && stepSizeChanged
          ? this.model.getData()
          : undefined,
      visibleRange:
        hasData && (coreChanged || typeChanged)
          ? this.getVisibleTimeRange()
          : undefined,
      redraw: [...redrawParts]
    };
  }

  public updateTheme(theme: ChartTheme) {
    this.updateOptions({ theme });
  }

  public setVolumeDraw(draw: boolean) {
    this.updateOptions({ volume: draw });
  }

  public updateLocalization(localization: ChartLocalizationOptions) {
    this.updateOptions(localization);
  }

  public updateLocale(locale: string, values?: LocaleValuesMap) {
    this.updateLocalization({ locale, localeValues: values });
  }

  getContext(type: ChartCanvasLayer): CanvasRenderingContext2D {
    return this.renderer.getContext(type);
  }

  /**
   * Get the logical canvas size.
   *
   * @param type which canvas you want1
   * @returns    the logical canvas size
   */
  getLogicalCanvas(type: ChartCanvasLayer) {
    return this.renderer.getLogicalSize(type);
  }

  /**
   * Gets the true drawing size.
   *
   * @returns the logical size of the main canvas
   */
  getDrawingSize() {
    return this.renderer.getDrawingSize();
  }

  /**
   * Gets the full drawing size including axis label areas.
   *
   * @returns the logical size of the full drawing area
   */
  getFullSize() {
    return this.renderer.getFullSize();
  }

  getFormatter() {
    return this.options.formatter;
  }

  /**
   * Gets the whole-bar visible range. `end` is one `stepSize` after the last
   * included bar and is therefore exclusive.
   *
   * @returns the currently visible time range
   */
  public getVisibleTimeRange(): TimeRange {
    return this.model.getVisibleTimeRange(this.options.stepSize);
  }

  /**
   * Gets interpolated timestamps for the precise fractional logical window.
   * Use this representation for lossless pan/zoom replication.
   */
  public getVisibleTimeWindow(): TimeRange {
    return this.model.getVisibleTimeWindow(
      this.options.stepSize,
      this.controller.getBarAlignment()
    );
  }

  /**
   * Replaces the complete chart dataset without mutating the input.
   * Points are sorted, snapped to `stepSize`, and merged by bucket. An empty
   * array clears all data-dependent state.
   *
   * @throws {TypeError} when a present data value is not finite
   */
  public setData(data: readonly ChartData[]): void {
    this.applyPaneLayout();
    this.model.replaceData(data, this.options.stepSize);

    if (!this.model.hasData()) {
      const crosshairCleared = this.resetEmptyDataState();
      this.commitChange({
        data: this.model.getData(),
        crosshairCleared,
        redraw: this.allRedrawParts,
        immediate: true
      });
      return;
    }

    if (this.model.isAutoTimeRange()) {
      this.refreshAutoTimeRange();
    }

    this.model.rebuildDataScale();

    let rangeChanged = this.resetVisibleIndexRange();
    if (this.pendingRestoredVisibleRange) {
      rangeChanged =
        this.updateVisibleIndexRange(
          this.resolveVisibleTimeWindow(this.pendingRestoredVisibleRange)
        ) || rangeChanged;
      this.pendingRestoredVisibleRange = undefined;
    }
    this.recalculateVisibleScale();
    const crosshairCleared = this.clearCrosshairModel();
    this.commitChange({
      data: this.model.getData(),
      visibleRange: rangeChanged ? this.getVisibleTimeRange() : undefined,
      crosshairCleared,
      redraw: this.allRedrawParts
    });
  }

  /**
   * Appends or merges one streaming point.
   *
   * @throws {TypeError} when a present data value is not finite
   * @throws {RangeError} when the timestamp is older than the latest point
   */
  public updateData(data: ChartData): void {
    if (!this.model.hasData()) {
      this.setData([data]);
      return;
    }

    const preserveRightEdge = this.isPinnedToRightEdge();
    const span = this.getVisibleIndexSpan();
    const mappedPoint = this.model.appendData(data, this.options.stepSize);
    this.model.addDataScalePoint(mappedPoint);

    if (this.model.isAutoTimeRange()) {
      this.refreshAutoTimeRange(true);
    }

    const rangeChanged = this.refreshIndexBounds({ preserveRightEdge, span });
    this.recalculateVisibleScale();
    this.commitChange({
      data: this.model.getData(),
      visibleRange: rangeChanged ? this.getVisibleTimeRange() : undefined,
      redraw: this.allRedrawParts
    });
  }

  public clearData(): void {
    this.setData([]);
  }

  private resetEmptyDataState(): boolean {
    this.model.resetEmptyView();
    this.renderer.resetDerivedState();
    this.model.clearScaleData();
    this.syncPaneTimeScales();
    this.syncMainPanePriceScale();
    return this.clearCrosshairModel();
  }

  /** @internal Called by an attached indicator's protected invalidation helper. */
  public invalidateIndicator(
    indicator: Indicator<any, any>,
    options: IndicatorInvalidationOptions = {}
  ): void {
    if (!this.extensionHost.isAttached(indicator)) return;

    const redrawParts = new Set<RenderLayer>();
    if (options.scale && this.model.hasData()) {
      this.recalculateVisibleScale();
      for (const layer of this.controllerRedrawParts) {
        redrawParts.add(layer);
      }
      redrawParts.add("indicators");
      redrawParts.add("annotations");
      redrawParts.add("crosshair");
    }
    if (options.label ?? true) {
      indicator.refreshLabel(this.interactionController.getCrosshairTime());
    }
    if (options.drawing ?? true) redrawParts.add("indicators");
    if (options.crosshair ?? true) redrawParts.add("crosshair");

    if (redrawParts.size > 0) this.requestRedraw([...redrawParts]);
  }

  /**
   * Adds and draws a new indicator.
   *
   * @param indicator indicator to draw
   */
  public addIndicator(
    indicator: Indicator<any, any>,
    options: IndicatorMutationOptions = {}
  ): () => void {
    const emit = options.emit ?? true;
    if (this.disposed) {
      throw new Error("Cannot add an indicator to a disposed chart.");
    }
    const paneled = this.isPaneledIndicator(indicator);
    try {
      this.extensionHost.addIndicator(indicator, paneled, {
        mount: () => {
          if (paneled) {
            const pane = this.paneLayout.addIndicatorPane(
              indicator,
              this.model.getTimeScale()
            );
            this.applyPaneLayout({
              resizeCanvases: false,
              resizeIndicators: false
            });
            indicator.init(this.paneLayout.getPaneInitParams(pane));
            this.container.appendChild(indicator.getContainer());
            this.applyPaneLayout();
          } else {
            this.indicatorLabelContainer.appendChild(
              indicator.getLabelContainer()
            );
          }
          indicator.refreshLabel();
        },
        unmount: () => {
          if (paneled) {
            if (indicator.getContainer().parentElement === this.container) {
              this.container.removeChild(indicator.getContainer());
            }
            const removedPane = this.paneLayout.removeIndicatorPane(indicator);
            this.interactionController.replacePane(
              removedPane,
              this.getMainPane()
            );
            this.applyPaneLayout();
          } else {
            this.model.removeVisibleScaleModifier(indicator);
            if (
              indicator.getLabelContainer().parentElement ===
              this.indicatorLabelContainer
            ) {
              this.indicatorLabelContainer.removeChild(
                indicator.getLabelContainer()
              );
            }
          }
        },
        release: () => indicator.releaseAttachment()
      });
    } finally {
      if (this.model.hasData()) this.recalculateVisibleScale();
      this.requestRedraw(this.allRedrawParts);
    }

    if (!this.extensionHost.isAttached(indicator)) {
      return () => {};
    }
    if (emit) {
      this.emit("indicator-add", { indicator });
    }
    return () => {
      this.removeIndicator(indicator, { emit });
    };
  }

  /**
   * Removes an indicator from the chart and redraws the indicators
   * to reflect the changes.
   *
   * @param indicator indicator to remove
   */

  public removeIndicator(
    indicator: Indicator<any, any>,
    options: IndicatorMutationOptions = {}
  ): boolean {
    let removed = false;
    try {
      removed = this.extensionHost.removeIndicator(indicator);
    } finally {
      if (this.model.hasData()) this.recalculateVisibleScale();
      this.requestRedraw(this.allRedrawParts);
    }
    if (!removed) return false;

    if (options.emit ?? true) {
      this.emit("indicator-remove", { indicator });
    }
    return true;
  }

  public getCrosshairState(): ChartCrosshairState | undefined {
    return this.interactionController.getCrosshairState();
  }

  public setCrosshair(
    options: ChartCrosshairOptions
  ): ChartCrosshairState | undefined {
    const state = this.crosshairResolver.resolveProgrammatic(options);
    if (!state) {
      this.clearCrosshair();
      return undefined;
    }

    this.interactionController.setProgrammaticCrosshair(state);
    this.requestRedraw("crosshair");
    this.emit("crosshair-change", state);

    return state;
  }

  public clearCrosshair(): void {
    const crosshairCleared = this.clearCrosshairModel();
    this.commitChange({
      crosshairCleared,
      redraw: "crosshair"
    });
  }

  private clearCrosshairModel() {
    const hadCrosshair = this.interactionController.clearCrosshair();
    this.refreshIndicatorLabels();
    return hadCrosshair;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.interactionController.dispose();
    this.renderer.stop();
    let detachError: unknown;
    // Extensions may persist final state while chart-owned model and DOM remain.
    try {
      this.extensionHost.dispose();
    } catch (error) {
      detachError = error;
    }
    this.paneLayout.dispose();
    this.removeAllListeners();
    this.renderer.dispose();
    this.overlay.destroy();
    this.container.remove();
    if (detachError !== undefined) throw detachError;
  }

  recalculateVisibleScale() {
    this.refreshIndexBounds();
    const visibleTimeRange = this.getVisibleTimeRange();
    const modifiers: ScaleRangeModifier[] = [];

    for (const indicator of this.getIndicators()) {
      this.model.removeVisibleScaleModifier(indicator);
      const modifier = indicator.getModifier(visibleTimeRange);
      if (modifier) modifiers.push(modifier);
    }

    const visibleDataPoints = this.model.recalculateVisibleScale(modifiers);
    this.syncMainPanePriceScale();
    return visibleDataPoints;
  }

  getLastVisibleDataPoints(): readonly ChartData[] {
    return this.model.getVisibleDataPoints();
  }

  getLastXGridCoords(): readonly number[] {
    return this.renderer.getLastXGridCoords();
  }

  public requestRedraw(
    part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>,
    immediate = false
  ) {
    this.renderer.requestRedraw(part, immediate);
  }
}
