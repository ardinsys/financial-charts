import { ChartController } from "../controllers/controller";
import { PaneledIndicator } from "../indicators/paneled-indicator";
import {
  Indicator,
  type DefaultIndicatorOptions,
} from "../indicators/indicator";
import { ChartIndicatorHost } from "../indicators/chart-indicator-host";
import type { ScaleRangeModifier } from "../scales/data-scale-model";
import type { TimeScaleRange } from "../scales/time-scale";
import { ChartData, TimeRange } from "./types";
import { EventEmitter, type ChartEventMap } from "./event-emitter";
import { createPositionedContainer } from "../utils/dom";
import { disposeInOrder } from "../utils/dispose";
import type { ChartDOMOverlay } from "../ui/chart-dom-adapter";
import type { RenderLayer } from "../render/render-pipeline";
import type { ChartRedrawPart } from "../render/chart-render-types";
import { ChartRenderer } from "../render/chart-renderer";
import { PaneLayout, type PaneHeightsInput } from "../panes/pane-layout";
import type { ChartPlugin } from "../plugin/chart-plugin";
import { ChartExtensionReadModel } from "../plugin/chart-extension-read-model";
import { ExtensionHost } from "../plugin/extension-host";
import { InteractionController } from "../interaction/interaction-controller";
import { CrosshairResolver } from "../interaction/crosshair-resolver";
import type {
  ChartCrosshairOptions,
  ChartCrosshairState,
} from "../interaction/crosshair";
import { getDefaultControllerConstructors } from "./internal-default-controllers";
import { ChartModel } from "./chart-model";
import { ChartOptionsState } from "./chart-options-state";
import { ControllerRegistry } from "./controller-registry";
import {
  ChartChangePublisher,
  type ChartChange,
} from "./chart-change-publisher";
import {
  type ChartOptions,
  type ChartOptionsChangeEvent,
  type ChartOptionsSnapshot,
  type ChartOptionsUpdate,
  type ControllerConstructor,
  type ControllerType,
  type MutableResolvedChartOptions,
} from "./chart-options";
import {
  type ChartPaneState,
  type ChartState,
  type ChartStateRestoreOptions,
  type ChartStateSerializationOptions,
} from "./chart-state";
import {
  ChartStateController,
  type ChartStateRuntimeSnapshot,
  type PreparedChartStateRestoration,
} from "./chart-state-controller";

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
  ResolvedChartOptions,
} from "./chart-options";
export {
  CHART_STATE_VERSION,
  type ChartCoreState,
  type ChartPaneState,
  type ChartState,
  type ChartStateContributor,
  type ChartStateRestoreOptions,
  type ChartStateRestoredEvent,
  type ChartStateSerializationOptions,
} from "./chart-state";
export type {
  ChartCrosshairOptions,
  ChartCrosshairState,
} from "../interaction/crosshair";
export type { ChartPaneSnapshot, PaneHeightsInput } from "../panes/pane-layout";

const ALL_REDRAW_PARTS = [
  "grid",
  "axes",
  "series",
  "indicators",
  "drawings",
  "annotations",
  "crosshair",
] as const;

function getThemeClassNames(theme: ChartOptionsSnapshot["theme"]): string[] {
  return [...new Set([theme.key, theme.base])].map(
    (key) => `financial-charts-${key}`
  );
}

export class FinancialChartBase {
  private readonly events = new EventEmitter<ChartEventMap>();
  private readonly controllerRegistry: ControllerRegistry;
  private controller: ChartController;
  protected container: HTMLElement;
  protected indicatorLabelContainer: HTMLElement;
  private readonly model = new ChartModel();
  private readonly optionsState!: ChartOptionsState;
  private overlay!: ChartDOMOverlay;
  private readonly renderer: ChartRenderer;
  private readonly paneLayout: PaneLayout;
  private readonly crosshairResolver: CrosshairResolver;
  private readonly interactionController: InteractionController;
  private readonly stateController: ChartStateController;

  private readonly extensionHost: ExtensionHost;
  private readonly changePublisher: ChartChangePublisher;
  private disposed = false;

  protected yLabelWidth = 80;
  protected xLabelHeight = 30;
  private containerWidth = 0;
  private containerHeight = 0;

  private get options(): MutableResolvedChartOptions {
    return this.optionsState.getResolved();
  }

  public on<K extends keyof ChartEventMap>(
    event: K,
    listener: (data: ChartEventMap[K]) => void
  ): () => void {
    return this.events.on(event, listener);
  }

  public off<K extends keyof ChartEventMap>(
    event: K,
    listener: (data: ChartEventMap[K]) => void
  ): void {
    this.events.off(event, listener);
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

  getTimeRange() {
    return this.model.getTimeRange();
  }

  /** Returns the precise fractional logical-index window. */
  getVisibleLogicalRange(): TimeScaleRange {
    return this.model.getVisibleIndexRange();
  }

  getOptions(): ChartOptionsSnapshot {
    return this.optionsState.getSnapshot();
  }

  /** Returns versioned, JSON-safe state without chart data or presentation. */
  public toJSON(options: ChartStateSerializationOptions = {}): ChartState {
    return this.stateController.toJSON(options);
  }

  /** Restores validated state and emits one `state-restored` event. */
  public restoreState(
    state: unknown,
    options: ChartStateRestoreOptions = {}
  ): void {
    if (this.disposed) {
      throw new Error("Cannot restore state into a disposed chart.");
    }
    const restoredState = this.stateController.restore(state, options);
    this.events.emit("state-restored", { state: restoredState });
  }

  /** Returns the stable readonly snapshot for the current mapped dataset. */
  getData(): readonly ChartData[] {
    return this.model.getData();
  }

  private syncPaneTimeScales() {
    const timeAnchorAlignment = this.controller.getTimeAnchorAlignment();
    for (const pane of this.paneLayout.getPanes()) {
      pane.setTimeScale(this.model.getTimeScale());
      pane.setTimeAnchorAlignment(timeAnchorAlignment);
    }
  }

  private syncMainPanePriceScale() {
    this.paneLayout
      .getMainPane()
      .setPriceRange(
        this.model.getVisibleScale().getYMin(),
        this.model.getVisibleScale().getYMax()
      );
  }

  private getMinimumVisibleIndexSlots() {
    const proportionalFactor = 1 / 50;
    const width = Math.max(this.renderer.getDrawingSize().width, 1);
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

  /** Returns the current logical plot width allocated to one visible bar. */
  public getPixelsPerBar(): number {
    return this.renderer.getDrawingSize().width / this.getVisibleIndexSpan();
  }

  private isPinnedToRightEdge() {
    return this.model.isPinnedToRightEdge();
  }

  private resetVisibleLogicalRange() {
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
      minimumVisibleSlots: this.getMinimumVisibleIndexSlots(),
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
  public setVisibleLogicalRange(range: TimeScaleRange): void {
    if (!this.model.hasData()) return;
    this.applyVisibleLogicalRange(range);
  }

  /**
   * Selects whole bars whose timestamps fall in `[start, end)`.
   * This is a no-op while the chart has no data.
   *
   * @throws {RangeError} when either boundary is not finite
   */
  public setVisibleTimeRange(range: TimeRange): void {
    if (!this.model.hasData()) return;
    this.setVisibleLogicalRange(this.model.logicalRangeForTimeRange(range));
  }

  /**
   * Sets a precise timestamp window while preserving fractional bar indexes.
   * This is a no-op while the chart has no data.
   *
   * @throws {RangeError} when either boundary is not finite
   */
  public setVisibleTimeWindow(range: TimeRange): void {
    if (!this.model.hasData()) return;
    this.setVisibleLogicalRange(this.resolveVisibleTimeWindow(range));
  }

  private resolveVisibleTimeWindow(range: TimeRange): TimeScaleRange {
    return this.model.logicalRangeForTimeWindow(
      range,
      this.options.stepSize,
      this.controller.getBarAlignment()
    );
  }

  private applyVisibleLogicalRange(range: TimeScaleRange): boolean {
    const changed = this.updateVisibleLogicalRange(range);
    if (!changed) return false;

    this.recalculateVisibleScale();
    this.changePublisher.commit({
      visibleRange: this.getVisibleTimeRange(),
      redraw: ALL_REDRAW_PARTS,
    });
    return true;
  }

  private updateVisibleLogicalRange(range: TimeScaleRange): boolean {
    const changed = this.model.setVisibleLogicalRange(range);
    this.syncPaneTimeScales();
    return changed;
  }

  private panInteractionByPixels(dx: number): void {
    const pixelsPerBar = this.getPixelsPerBar();
    if (pixelsPerBar <= 0) return;

    const delta = dx / pixelsPerBar;
    const visibleRange = this.model.getVisibleIndexRange();
    this.setVisibleLogicalRange({
      from: visibleRange.from - delta,
      to: visibleRange.to - delta,
    });
  }

  private zoomInteractionAtPixel(zoomFactor: number, pixel: number): void {
    const width = Math.max(this.renderer.getDrawingSize().width, 1);
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

    this.setVisibleLogicalRange({ from, to: from + newSpan });
  }

  getIndicators(): readonly Indicator<object, DefaultIndicatorOptions>[] {
    return this.extensionHost.getAllIndicators();
  }

  /** Returns an attached indicator by its unique instance identity. */
  getIndicatorById(
    instanceId: string
  ): Indicator<object, DefaultIndicatorOptions> | undefined {
    return this.extensionHost.getIndicatorById(instanceId);
  }

  /** Returns all attached indicators sharing a factory/type identity. */
  getIndicatorsByType(
    typeId: string
  ): readonly Indicator<object, DefaultIndicatorOptions>[] {
    return this.extensionHost.getIndicatorsByType(typeId);
  }

  getPanes() {
    return this.paneLayout.getSnapshot();
  }

  getMainPane() {
    return this.paneLayout.getMainSnapshot();
  }

  setPaneHeights(heights: PaneHeightsInput): void {
    this.applyPaneHeights(heights);
    this.notifyPaneHeightsChanged();
  }

  private applyPaneHeights(heights: PaneHeightsInput): void {
    this.containerWidth = this.container.offsetWidth;
    this.containerHeight = this.container.offsetHeight;
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
      this.requestRedraw(ALL_REDRAW_PARTS);
    }

    return () => {
      this.removePlugin(plugin);
    };
  }

  removePlugin(plugin: ChartPlugin): boolean {
    try {
      return this.extensionHost.removePlugin(plugin);
    } finally {
      this.requestRedraw(ALL_REDRAW_PARTS);
    }
  }

  private getPaneLayoutHeight() {
    return Math.max(0, this.containerHeight - this.xLabelHeight);
  }

  private applyPaneLayout({
    resizeCanvases = true,
    resizeIndicators = true,
    redraw = false,
    immediate = false,
  }: {
    resizeCanvases?: boolean;
    resizeIndicators?: boolean;
    redraw?: boolean;
    immediate?: boolean;
  } = {}) {
    this.containerWidth = this.container.offsetWidth;
    this.containerHeight = this.container.offsetHeight;
    this.paneLayout.applyGeometry({
      width: Math.max(0, this.containerWidth - this.yLabelWidth),
      height: this.getPaneLayoutHeight(),
      yAxisWidth: this.yLabelWidth,
      containerWidth: this.containerWidth,
      themeKey: this.options.theme.key,
    });

    if (resizeCanvases && this.renderer) this.renderer.resizeCanvases();
    if (resizeIndicators) this.paneLayout.resizeIndicators();
    if (redraw) this.requestRedraw(ALL_REDRAW_PARTS, immediate);
  }

  private refreshIndicatorLabels(dataTime?: number) {
    for (const indicator of this.extensionHost.getPaneledIndicators()) {
      indicator.refreshLabel(dataTime);
    }
    for (const indicator of this.extensionHost.getIndicators()) {
      indicator.refreshLabel(dataTime);
    }
  }

  constructor(container: HTMLElement, options: ChartOptions) {
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
    const domAdapter = this.options.domAdapter;
    this.container = createPositionedContainer({
      position: "relative",
      overflow: "hidden",
      width: "100%",
      height: "100%",
      backgroundColor: this.options.theme.backgroundColor,
    });
    this.container.classList.add(
      "financial-charts",
      ...getThemeClassNames(this.options.theme)
    );
    container.appendChild(this.container);
    this.containerWidth = this.container.offsetWidth;
    this.containerHeight = this.container.offsetHeight;
    this.paneLayout = new PaneLayout(this.container, domAdapter, {
      mainPaneMinHeight: 80,
      indicatorPaneMinHeight: 50,
      dividerHeight: 8,
      onInteractiveResize: () => {
        this.applyPaneLayout({ redraw: true, immediate: true });
        this.notifyPaneHeightsChanged();
      },
    });

    this.overlay = domAdapter.createOverlay(this.container, {
      themeKey: this.options.theme.key,
      labelTopOffset: this.options.theme.crosshair.infoLine.fontSize + 20,
    });
    this.indicatorLabelContainer = this.overlay.indicatorLabelContainer;

    this.model.configureTimeRange(
      this.options.timeRange,
      this.options.stepSize,
      1
    );

    this.renderer = new ChartRenderer(
      this.container,
      {
        getOptions: () => this.options,
        hasData: () => this.model.hasData(),
        getTimes: () => this.model.getTimes(),
        getVisibleData: () => this.model.getVisibleDataPoints(),
        getVisibleIndexRange: () => this.model.getVisibleIndexRange(),
        getTimeRange: () => this.model.getTimeRange(),
        getTimeScale: () => this.model.getTimeScale(),
        getVisibleScale: () => this.model.getVisibleScale(),
        getTimeAnchorAlignment: () => this.controller.getTimeAnchorAlignment(),
        getPixelsPerBar: () => this.getPixelsPerBar(),
        getController: () => this.controller,
        getIndicators: () => this.extensionHost.getIndicators(),
        getPaneledIndicators: () => this.extensionHost.getPaneledIndicators(),
        getPanes: () => this.paneLayout.getPanes(),
        getMainPane: () => this.paneLayout.getMainPane(),
        getPaneById: (paneId) => this.paneLayout.getPaneById(paneId),
        getPaneIndicator: (pane) => this.paneLayout.getIndicatorForPane(pane),
        getPriceAxisAnnotations: () =>
          this.extensionHost.getPriceAxisAnnotations(),
        getCrosshairState: () => this.interactionController.getCrosshairState(),
        shouldDrawCrosshair: () =>
          this.interactionController.shouldDrawCrosshair(),
        refreshIndicatorLabels: (time) => this.refreshIndicatorLabels(time),
        beforeDraw: () => this.extensionHost.beforeDrawPlugins(),
        drawPlugins: () => this.extensionHost.drawPlugins(),
        afterDraw: () => this.extensionHost.afterDrawPlugins(),
      },
      {
        getLayout: () => {
          const region = this.paneLayout.getMainPane().getRegion();
          const yAxisRegion = this.paneLayout.getMainPane().getYAxisRegion();
          return {
            plotWidth: region.width,
            plotHeight: region.height,
            paneLayoutHeight: this.getPaneLayoutHeight(),
            yAxisWidth: yAxisRegion.width,
            yAxisHeight: yAxisRegion.height,
            fullWidth: this.containerWidth,
            fullHeight: this.containerHeight,
            xAxisHeight: this.xLabelHeight,
          };
        },
        onResize: () => this.handleRendererResize(),
      }
    );
    const extensionReadModel = new ChartExtensionReadModel(
      this.model,
      this.optionsState,
      this.paneLayout
    );
    const indicatorHost = new ChartIndicatorHost(
      this.model,
      this.renderer,
      extensionReadModel,
      {
        getCrosshairTime: () => this.interactionController.getCrosshairTime(),
        recalculateVisibleScale: () => this.recalculateVisibleScale(),
        removeIndicator: (indicator) => {
          this.removeIndicator(indicator);
        },
      }
    );
    this.extensionHost = new ExtensionHost(
      this.events,
      {
        getCrosshairState: () => this.interactionController.getCrosshairState(),
        getPaneHeightRatios: () => this.capturePaneHeightRatios(),
        setCrosshair: (options) => this.setCrosshair(options),
        clearCrosshair: () => this.clearCrosshair(),
        setPaneHeightRatios: (panes) => {
          if (this.applyPaneHeightRatios(panes)) {
            this.notifyPaneHeightsChanged();
          }
        },
        setVisibleTimeWindow: (range) => this.setVisibleTimeWindow(range),
        addIndicator: (indicator) => {
          this.addIndicator(indicator);
        },
        removeIndicator: (indicator) => {
          this.removeIndicator(indicator);
        },
        removeExtension: (extension) => {
          if (extension instanceof Indicator) {
            this.removeIndicator(extension);
          } else {
            this.removePlugin(extension as ChartPlugin);
          }
        },
      },
      domAdapter,
      this.renderer,
      container,
      extensionReadModel,
      indicatorHost
    );
    this.changePublisher = new ChartChangePublisher(
      this.extensionHost,
      this.events,
      (part, immediate) => {
        if (immediate) {
          this.requestRedraw(part, true);
        } else {
          this.requestRedraw(part);
        }
      }
    );
    const ControllerClass = this.getControllerClass(this.options.type);
    this.controller = new ControllerClass(this.renderer, this.options);
    this.model.configureScales(
      (data, timeRange) => this.controller.createDataScale(data, timeRange),
      this.controller.getBarAlignment()
    );
    this.applyPaneLayout({
      resizeCanvases: false,
      resizeIndicators: false,
    });
    this.crosshairResolver = new CrosshairResolver(
      this.model,
      this.paneLayout,
      {
        normalizeTime: (point) =>
          this.controller.getTimeFromRawDataPoint(point),
        getMainCanvas: () => this.renderer.getCanvas("main"),
        getDrawingWidth: () => this.renderer.getDrawingSize().width,
        getPlotHeight: () => this.getPaneLayoutHeight(),
        getTimeAnchorAlignment: () => this.controller.getTimeAnchorAlignment(),
      }
    );
    const topCanvas = this.renderer.getCanvas("crosshair");
    this.interactionController = new InteractionController(
      {
        hasData: () => this.model.hasData(),
        createPointerEvent: (type, x, y, source) =>
          this.crosshairResolver.createPointerEvent(type, x, y, source),
        dispatchPointer: (event) => this.extensionHost.notifyPointer(event),
        resolveDataPoint: (x, y, scale) =>
          this.crosshairResolver.resolveDataPoint(x, y, scale),
        resolveCrosshair: (x, y) => this.crosshairResolver.resolvePointer(x, y),
        getPaneById: (paneId) => this.paneLayout.getPaneById(paneId),
        panByPixels: (dx) => this.panInteractionByPixels(dx),
        zoomAtPixel: (factor, pixel) =>
          this.zoomInteractionAtPixel(factor, pixel),
        clearCrosshair: () => this.clearCrosshair(),
        crosshairChanged: (state) => {
          this.changePublisher.commit({
            crosshairChanged: state,
            redraw: "crosshair",
          });
        },
        click: (event, point) => this.events.emit("click", { event, point }),
        touchClick: (event, point) =>
          this.events.emit("touch-click", { event, point }),
      },
      topCanvas
    );
    this.stateController = new ChartStateController(
      () => this.captureChartState(),
      (restoration) => this.applyChartStateRestoration(restoration),
      (range) =>
        this.updateVisibleLogicalRange(this.resolveVisibleTimeWindow(range))
    );
  }

  private captureChartState(): ChartStateRuntimeSnapshot {
    const configuredTimeRange = this.options.timeRange;
    return {
      state: {
        core: {
          type: this.options.type,
          timeRange:
            configuredTimeRange === "auto"
              ? "auto"
              : { ...configuredTimeRange },
          stepSize: this.options.stepSize,
          maxZoom: this.options.maxZoom,
          volume: this.options.volume,
        },
        visibleRange: this.getVisibleTimeWindow(),
        panes: this.capturePaneHeightRatios(),
        indicators: this.extensionHost
          .getAllIndicators()
          .map((indicator) => indicator.toJSON()),
      },
      mainPaneId: this.paneLayout.getMainPane().getId(),
      controllerTypes: this.options.controllers.map(
        (controller) => controller.ID
      ),
    };
  }

  private capturePaneHeightRatios(): readonly ChartPaneState[] {
    const panes = this.paneLayout.getPanes();
    const totalPaneHeight = panes.reduce(
      (sum, pane) => sum + this.paneLayout.getPaneHeight(pane),
      0
    );
    const fallbackPaneRatio = 1 / panes.length;
    return panes.map((pane) => {
      const indicator = this.paneLayout.getIndicatorForPane(pane);
      return {
        id: pane.getId(),
        heightRatio:
          totalPaneHeight > 0
            ? this.paneLayout.getPaneHeight(pane) / totalPaneHeight
            : fallbackPaneRatio,
        ...(indicator
          ? { indicatorInstanceId: indicator.getInstanceId() }
          : {}),
      };
    });
  }

  private applyPaneHeightRatios(panes: readonly ChartPaneState[]): boolean {
    const localPanes = this.capturePaneHeightRatios();
    if (panes.length !== localPanes.length) return false;
    const mainPaneId = localPanes.find(
      ({ indicatorInstanceId }) => indicatorInstanceId === undefined
    )?.id;
    const paneIdByIndicator = new Map(
      localPanes.flatMap(({ id, indicatorInstanceId }) =>
        indicatorInstanceId ? [[indicatorInstanceId, id] as const] : []
      )
    );
    const paneLayoutHeight = this.getPaneLayoutHeight();
    const heights: Partial<Record<number, number>> = {};
    for (const pane of panes) {
      const localPaneId = pane.indicatorInstanceId
        ? paneIdByIndicator.get(pane.indicatorInstanceId)
        : mainPaneId;
      if (localPaneId === undefined) return false;
      heights[localPaneId] = pane.heightRatio * paneLayoutHeight;
    }
    this.applyPaneHeights(heights);
    return true;
  }

  private notifyPaneHeightsChanged(): void {
    this.changePublisher.commit({
      paneHeights: this.capturePaneHeightRatios(),
    });
  }

  private applyChartStateRestoration({
    state,
    indicators,
    paneIdsByIndicator,
    contributors,
  }: PreparedChartStateRestoration): boolean {
    let optionsEvent: ChartOptionsChangeEvent | undefined;
    let visibleRangeDeferred = false;
    this.renderer.setPaused(true);
    this.paneLayout.setRestoredPaneIds(paneIdsByIndicator);
    try {
      for (const indicator of this.extensionHost.getAllIndicators()) {
        this.detachIndicator(indicator, false);
      }

      optionsEvent = this.applyOptionsUpdate(state.core)?.options;
      if (this.model.hasData()) {
        this.updateVisibleLogicalRange(
          this.resolveVisibleTimeWindow(state.visibleRange)
        );
      } else {
        visibleRangeDeferred = true;
      }

      for (const indicator of indicators) {
        this.attachIndicator(indicator, false);
      }

      this.applyPaneHeightRatios(state.panes);

      for (const contributor of contributors) {
        contributor.fromJSON(state.contributions?.[contributor.key]);
      }

      if (this.model.hasData()) {
        this.recalculateVisibleScale();
      }
      this.extensionHost.deliverCurrentState(this.getPlugins(), optionsEvent);
    } finally {
      this.paneLayout.setRestoredPaneIds();
      this.renderer.setPaused(false);
      this.requestRedraw(ALL_REDRAW_PARTS);
    }
    return visibleRangeDeferred;
  }

  private handleRendererResize(): void {
    this.interactionController.invalidateBounds();
    this.applyPaneLayout();
    this.indicatorLabelContainer.style.maxHeight =
      this.renderer.getLogicalSize("main").height -
      this.options.theme.crosshair.infoLine.fontSize -
      30 +
      "px";

    if (!this.model.hasData()) return;
    const preserveRightEdge = this.isPinnedToRightEdge();
    const span = this.getVisibleIndexSpan();
    const timeRangeChanged = this.model.isAutoTimeRange()
      ? this.refreshAutoTimeRange()
      : false;
    const rangeChanged = this.refreshIndexBounds({
      reset: span === this.getIndexBoundsSpan(),
      preserveRightEdge,
      span,
    });
    if (rangeChanged || timeRangeChanged) this.recalculateVisibleScale();
    this.changePublisher.commit({
      visibleRange: rangeChanged ? this.getVisibleTimeRange() : undefined,
      redraw: ALL_REDRAW_PARTS,
      immediate: true,
    });
  }

  private refreshAutoTimeRange(): boolean {
    return this.model.updateAutoTimeRange(
      this.options.stepSize,
      this.getMinimumVisibleIndexSlots()
    );
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
      (data, timeRange) => this.controller.createDataScale(data, timeRange),
      this.controller.getBarAlignment()
    );
    if (resetVisibleRange) this.resetVisibleLogicalRange();
    this.syncPaneTimeScales();
    if (this.model.hasData()) this.recalculateVisibleScale();
  }

  private applyThemeOverlay(previousTheme: ChartOptionsSnapshot["theme"]) {
    this.container.classList.remove(...getThemeClassNames(previousTheme));
    this.container.classList.add(...getThemeClassNames(this.options.theme));
    this.container.style.backgroundColor = this.options.theme.backgroundColor;
    this.overlay.update({
      themeKey: this.options.theme.key,
      labelTopOffset: this.options.theme.crosshair.infoLine.fontSize + 20,
    });
    this.paneLayout.updatePaneDividers(this.options.theme.key);
  }

  private refreshLocalizationLabels() {
    for (const indicator of this.extensionHost.getIndicators()) {
      indicator.refreshLabel();
    }
    for (const indicator of this.extensionHost.getPaneledIndicators()) {
      indicator.refreshLabel();
    }
  }

  /** Applies an options patch in one reset, remap, and redraw cycle. */
  public updateOptions(update: ChartOptionsUpdate): void {
    this.assertActive("update options on");
    const change = this.applyOptionsUpdate(update);
    if (change) this.changePublisher.commit(change);
  }

  private applyOptionsUpdate(
    update: ChartOptionsUpdate
  ): ChartChange | undefined {
    const event = this.optionsState.applyUpdate(update, (type) => {
      this.getControllerClass(type);
    });
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

    if (typeChanged) {
      const ControllerClass = this.getControllerClass(this.options.type);
      this.controller = new ControllerClass(this.renderer, this.options);
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

    if (changed.has("theme")) this.applyThemeOverlay(event.previous.theme);
    if (localizationChanged) this.refreshLocalizationLabels();

    const redrawParts = new Set<RenderLayer>();
    const includeRedrawParts = (parts: readonly RenderLayer[]) => {
      for (const part of parts) redrawParts.add(part);
    };
    if (changed.has("theme")) {
      includeRedrawParts(["grid", "axes"]);
    }
    if (this.model.hasData()) {
      if (typeChanged || coreChanged || changed.has("theme")) {
        includeRedrawParts(ALL_REDRAW_PARTS);
      }
      if (changed.has("volume")) {
        includeRedrawParts(["series", "crosshair"]);
      }
      if (localizationChanged) {
        includeRedrawParts(["axes", "indicators", "annotations", "crosshair"]);
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
      data: hasData && stepSizeChanged ? this.model.getData() : undefined,
      visibleRange:
        hasData && (coreChanged || typeChanged)
          ? this.getVisibleTimeRange()
          : undefined,
      redraw: [...redrawParts],
    };
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
    this.assertActive("set data on");
    this.applyPaneLayout();
    this.model.replaceData(data, this.options.stepSize);

    if (!this.model.hasData()) {
      const crosshairCleared = this.resetEmptyDataState();
      this.changePublisher.commit({
        data: this.model.getData(),
        crosshairCleared,
        redraw: ALL_REDRAW_PARTS,
        immediate: true,
      });
      return;
    }

    if (this.model.isAutoTimeRange()) {
      this.refreshAutoTimeRange();
    }

    let rangeChanged = this.resetVisibleLogicalRange();
    rangeChanged =
      this.stateController.applyPendingVisibleRange() || rangeChanged;
    this.recalculateVisibleScale();
    const crosshairCleared = this.clearCrosshairModel();
    this.changePublisher.commit({
      data: this.model.getData(),
      visibleRange: rangeChanged ? this.getVisibleTimeRange() : undefined,
      crosshairCleared,
      redraw: ALL_REDRAW_PARTS,
    });
  }

  /**
   * Appends or merges one streaming point.
   *
   * @throws {TypeError} when a present data value is not finite
   * @throws {RangeError} when the timestamp is older than the latest point
   */
  public updateData(data: ChartData): void {
    this.assertActive("update data on");
    if (!this.model.hasData()) {
      this.setData([data]);
      return;
    }

    const preserveRightEdge = this.isPinnedToRightEdge();
    const span = this.getVisibleIndexSpan();
    this.model.appendData(data, this.options.stepSize);

    if (this.model.isAutoTimeRange()) {
      this.refreshAutoTimeRange();
    }

    const rangeChanged = this.refreshIndexBounds({
      preserveRightEdge,
      span,
    });
    this.recalculateVisibleScale();
    this.changePublisher.commit({
      data: this.model.getData(),
      visibleRange: rangeChanged ? this.getVisibleTimeRange() : undefined,
      redraw: ALL_REDRAW_PARTS,
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

  /**
   * Adds and draws a new indicator.
   *
   * @param indicator indicator to draw
   */
  public addIndicator(
    indicator: Indicator<object, DefaultIndicatorOptions>
  ): () => void {
    return this.attachIndicator(indicator, true);
  }

  private attachIndicator(
    indicator: Indicator<any, any>,
    emit: boolean
  ): () => void {
    if (this.disposed) {
      throw new Error("Cannot add an indicator to a disposed chart.");
    }
    const paneled = indicator instanceof PaneledIndicator;
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
              resizeIndicators: false,
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
              this.paneLayout.getMainPane()
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
        release: () => indicator.releaseAttachment(),
      });
    } finally {
      if (this.model.hasData()) this.recalculateVisibleScale();
      this.requestRedraw(ALL_REDRAW_PARTS);
    }

    if (!this.extensionHost.isAttached(indicator)) {
      return () => {};
    }
    if (emit) {
      this.events.emit("indicator-add", { indicator });
      if (indicator instanceof PaneledIndicator) {
        this.notifyPaneHeightsChanged();
      }
    }
    return () => {
      this.detachIndicator(indicator, emit);
    };
  }

  /**
   * Removes an indicator from the chart and redraws the indicators
   * to reflect the changes.
   *
   * @param indicator indicator to remove
   */

  public removeIndicator(
    indicator: Indicator<object, DefaultIndicatorOptions>
  ): boolean {
    return this.detachIndicator(indicator, true);
  }

  private detachIndicator(
    indicator: Indicator<any, any>,
    emit: boolean
  ): boolean {
    let removed = false;
    try {
      removed = this.extensionHost.removeIndicator(indicator);
    } finally {
      if (this.model.hasData()) this.recalculateVisibleScale();
      this.requestRedraw(ALL_REDRAW_PARTS);
    }
    if (!removed) return false;

    if (emit) {
      this.events.emit("indicator-remove", { indicator });
      if (indicator instanceof PaneledIndicator) {
        this.notifyPaneHeightsChanged();
      }
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
    this.changePublisher.commit({
      crosshairChanged: state,
      redraw: "crosshair",
    });

    return state;
  }

  public clearCrosshair(): void {
    const crosshairCleared = this.clearCrosshairModel();
    this.changePublisher.commit({
      crosshairCleared,
      redraw: "crosshair",
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

    disposeInOrder([
      () => this.interactionController.dispose(),
      () => this.renderer.stop(),
      () => this.extensionHost.dispose(),
      () => this.paneLayout.dispose(),
      () => this.events.removeAllListeners(),
      () => this.renderer.dispose(),
      () => this.overlay.destroy(),
      () => this.container.remove(),
    ]);
  }

  private assertActive(operation: string): void {
    if (this.disposed) {
      throw new Error(`Cannot ${operation} a disposed chart.`);
    }
  }

  private recalculateVisibleScale() {
    const visibleTimeRange = this.getVisibleTimeRange();
    const modifiers: ScaleRangeModifier[] = [];

    for (const indicator of this.extensionHost.getIndicators()) {
      this.model.removeVisibleScaleModifier(indicator);
      const modifier = indicator.getModifier(visibleTimeRange);
      if (modifier) modifiers.push(modifier);
    }

    const visibleDataPoints = this.model.recalculateVisibleScale(modifiers);
    this.syncMainPanePriceScale();
    return visibleDataPoints;
  }

  private requestRedraw(
    part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>,
    immediate = false
  ) {
    this.renderer.requestRedraw(part, immediate);
  }
}
