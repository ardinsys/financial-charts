import { ChartController } from "../controllers/controller";
import type { PaneledIndicator } from "../indicators/paneled-indicator";
import {
  Indicator,
  restoreIndicator,
  type IndicatorInvalidationOptions,
  type IndicatorMutationOptions
} from "../indicators/indicator";
import {
  DataScaleModel,
  DataScaleTimeOptions
} from "../scales/data-scale-model";
import type { BarAlignment, TimeScaleRange } from "../scales/time-scale";
import { DefaultFormatter } from "./formatter";
import {
  defaultLightTheme,
  mergeThemes,
  type ChartTheme
} from "./themes";
import { ChartData, TimeRange } from "./types";
import { EventEmitter } from "./event-emitter";
import { createPositionedContainer } from "../utils/dom";
import type { ChartDOMOverlay, ChartDOMAdapter } from "../ui/chart-dom-adapter";
import { DefaultDOMAdapter } from "../ui/default-dom-adapter";
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
import type {
  ChartCrosshairOptions,
  ChartCrosshairState
} from "../interaction/crosshair";
import { getDefaultControllerConstructors } from "./internal-default-controllers";
import { ChartModel } from "./chart-model";
import {
  assertPositiveOption,
  assertTimeRangeOption,
  optionValuesEqual,
  snapshotOptionValue,
  timeRangeOptionsEqual,
  type ChartLocalizationOptions,
  type ChartOptionKey,
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

const logicalRangeEpsilon = 1e-9;
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
  private readonly controllers = new Map<
    ControllerType,
    ControllerConstructor
  >();
  private controller: ChartController;
  protected outsideContainer: HTMLElement;
  protected container: HTMLElement;
  protected indicatorLabelContainer: HTMLElement;
  private readonly model = new ChartModel();
  protected options!: MutableResolvedChartOptions;
  private optionsSnapshot!: ChartOptionsSnapshot;
  private readonly defaultControllerConstructors: readonly ControllerConstructor[];
  protected visibleIndexRange: TimeScaleRange = { from: 0, to: 1 };
  private indexBounds: TimeScaleRange = { from: 0, to: 1 };
  protected timeRange!: TimeRange;
  protected autoTimeRange = false;
  protected dataScale!: DataScaleModel;
  protected visibleScale: DataScaleModel;
  private domAdapter: ChartDOMAdapter;
  private overlay!: ChartDOMOverlay;
  private readonly renderer: ChartRenderer;
  private readonly paneLayout: PaneLayout;
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


  public registerController(controllerClass: ControllerConstructor) {
    const id = this.getRegistrationId(controllerClass);
    this.controllers.set(id as ControllerType, controllerClass);
    this.syncRegisteredControllers();
  }

  public registerDefaults() {
    for (const controller of this.defaultControllerConstructors) {
      const id = this.getRegistrationId(controller);
      this.controllers.set(id as ControllerType, controller);
    }
    this.syncRegisteredControllers();
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
    if (!this.options) return;
    this.options.controllers = Object.freeze([...this.controllers.values()]);
    this.refreshOptionsSnapshot();
  }

  private static resolveRuntimeLocale() {
    if (typeof navigator !== "undefined" && navigator.language) {
      return navigator.language;
    }

    return "en-US";
  }

  private getRegistrationId(registrationClass: ControllerConstructor) {
    if (registrationClass.ID === "default" || !registrationClass.ID) {
      throw new Error("Controller must have a static ID field!");
    }

    return registrationClass.ID;
  }

  private resolveOptions(
    options: ChartOptions,
    includeDefaultControllers: boolean
  ): MutableResolvedChartOptions {
    const type =
      options.type ??
      (includeDefaultControllers && this.controllers.has("candle")
        ? "candle"
        : this.controllers.keys().next().value);
    if (!type) {
      throw new Error(
        "A chart type or at least one controller must be provided."
      );
    }

    const timeRange = options.timeRange ?? "auto";
    assertTimeRangeOption(timeRange);
    assertPositiveOption("stepSize", options.stepSize);
    assertPositiveOption("maxZoom", options.maxZoom ?? 100);

    const locale =
      options.locale ||
      options.formatter?.getLocale() ||
      FinancialChart.resolveRuntimeLocale();
    const timeZone = options.timeZone ?? options.formatter?.getTimeZone?.();
    const formatter =
      options.formatter ||
      new DefaultFormatter({
        locale,
        timeZone
      });

    formatter.setLocale(locale);
    formatter.setTimeZone?.(timeZone);

    return {
      type,
      timeRange:
        timeRange === "auto" ? "auto" : Object.freeze({ ...timeRange }),
      stepSize: options.stepSize,
      maxZoom: options.maxZoom ?? 100,
      volume: options.volume ?? true,
      controllers: Object.freeze([...this.controllers.values()]),
      includeDefaultControllers,
      locale,
      timeZone,
      formatter,
      theme: snapshotOptionValue(
        mergeThemes(defaultLightTheme, options.theme)
      ),
      domAdapter: options.domAdapter ?? new DefaultDOMAdapter(),
      localeValues: snapshotOptionValue({
        ...this.getDefaultLocaleValues(),
        ...options.localeValues
      })
    };
  }

  private refreshOptionsSnapshot() {
    this.optionsSnapshot = Object.freeze({
      type: this.options.type,
      timeRange: this.options.timeRange,
      stepSize: this.options.stepSize,
      maxZoom: this.options.maxZoom,
      volume: this.options.volume,
      controllers: this.options.controllers,
      includeDefaultControllers: this.options.includeDefaultControllers,
      locale: this.options.locale,
      timeZone: this.options.timeZone,
      formatter: this.options.formatter,
      theme: this.options.theme,
      domAdapter: this.options.domAdapter,
      localeValues: this.options.localeValues
    });
  }

  private getControllerClass(type: ControllerType) {
    const ControllerClass = this.controllers.get(type);

    if (!ControllerClass) {
      throw new Error(`Controller: ${type} is not registered!`);
    }

    return ControllerClass;
  }

  getYLabelWidth() {
    return this.yLabelWidth;
  }

  getTimeRange() {
    return this.timeRange;
  }

  getVisibleScale() {
    return this.visibleScale;
  }

  getTimeScale() {
    return this.visibleScale.getTimeScale();
  }

  getPriceScale() {
    return this.getMainPane().getPriceScale();
  }

  getVolumeScale() {
    return this.visibleScale.getVolumeScale();
  }

  /** Returns the precise fractional logical-index window. */
  getVisibleLogicalRange(): TimeScaleRange {
    return { ...this.visibleIndexRange };
  }

  getController() {
    return this.controller;
  }

  getTimeAnchorAlignment(): BarAlignment {
    return this.controller.getTimeAnchorAlignment();
  }

  getOptions(): ChartOptionsSnapshot {
    return this.optionsSnapshot;
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

  private getTimeScaleOptions(): DataScaleTimeOptions {
    return {
      barAlignment: this.controller.getBarAlignment(),
      indexRange: this.visibleIndexRange,
      timeValues: this.model.getTimes()
    };
  }

  private syncTimeScales() {
    const options = this.getTimeScaleOptions();
    this.visibleScale.configureTimeScale(options);
    if (this.dataScale) {
      this.dataScale.configureTimeScale(options);
    }
    const timeAnchorAlignment = this.getTimeAnchorAlignment();
    for (const pane of this.getPanes()) {
      pane.setTimeScale(this.visibleScale.getTimeScale());
      pane.setTimeAnchorAlignment(timeAnchorAlignment);
    }
  }

  private syncMainPanePriceScale() {
    this.getMainPane().setPriceRange(
      this.visibleScale.getYMin(),
      this.visibleScale.getYMax()
    );
  }

  private getMinimumVisibleIndexSlots() {
    const proportionalFactor = 1 / 50;
    const width = Math.max(this.getDrawingSize().width, 1);
    let dynamicStepWidth = width * proportionalFactor;
    dynamicStepWidth = Math.max(15, Math.min(30, dynamicStepWidth));
    return Math.max(1, Math.floor(width / dynamicStepWidth));
  }

  private calculateIndexBounds(): TimeScaleRange {
    if (!this.model.hasData()) {
      return { from: 0, to: 1, rightOffset: 0 };
    }

    if (this.autoTimeRange) {
      const slotCount = Math.max(
        this.model.length,
        this.getMinimumVisibleIndexSlots()
      );

      return {
        from: 0,
        to: slotCount,
        rightOffset: Math.max(0, slotCount - this.model.length)
      };
    }

    const range = this.model.getIndexRangeForTimeRange(
      this.timeRange.start,
      this.timeRange.end
    );

    return {
      from: range.from,
      to: range.to,
      rightOffset: Math.max(0, range.to - this.model.length)
    };
  }

  private getIndexBoundsSpan() {
    return Math.max(this.indexBounds.to - this.indexBounds.from, 1);
  }

  private getVisibleIndexSpan() {
    return Math.max(this.visibleIndexRange.to - this.visibleIndexRange.from, 1);
  }

  private getBarAlignmentOffset() {
    return this.controller.getBarAlignment() === "center" ? 0.5 : 0;
  }

  getPixelsPerBar() {
    return this.getDrawingSize().width / this.getVisibleIndexSpan();
  }

  private isPinnedToRightEdge() {
    return Math.abs(this.visibleIndexRange.to - this.indexBounds.to) < 1e-6;
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
    const span = options.span ?? this.getVisibleIndexSpan();
    this.indexBounds = this.calculateIndexBounds();

    let range = this.visibleIndexRange;

    if (options.reset) {
      range = { ...this.indexBounds };
    } else if (options.preserveRightEdge) {
      const clampedSpan = Math.min(span, this.getIndexBoundsSpan());
      range = {
        from: this.indexBounds.to - clampedSpan,
        to: this.indexBounds.to
      };
    }

    return this.updateVisibleIndexRange(range);
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
    this.assertFiniteVisibleTimeRange(range);
    const end = Math.max(range.start, range.end - 1);
    this.setVisibleIndexRange(
      this.model.getIndexRangeForTimeRange(range.start, end)
    );
  }

  /**
   * Sets a precise timestamp window while preserving fractional bar indexes.
   * This is a no-op while the chart has no data.
   *
   * @throws {RangeError} when either boundary is not finite
   */
  public setVisibleTimeWindow(range: TimeRange): void {
    if (!this.model.hasData()) return;
    this.assertFiniteVisibleTimeRange(range);

    this.setVisibleIndexRange(this.resolveVisibleTimeWindow(range));
  }

  private resolveVisibleTimeWindow(range: TimeRange): TimeScaleRange {
    this.assertFiniteVisibleTimeRange(range);

    const alignmentOffset = this.getBarAlignmentOffset();
    const from =
      this.model.logicalIndexForTime(range.start, this.options.stepSize) +
      alignmentOffset;
    const to =
      this.model.logicalIndexForTime(range.end, this.options.stepSize) +
      alignmentOffset;

    return { from, to: Math.max(from + 1, to) };
  }

  private assertFiniteVisibleTimeRange(range: TimeRange): void {
    if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
      throw new RangeError("Visible time range values must be finite.");
    }
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
    const previous = this.visibleIndexRange;
    const next = this.clampVisibleIndexRange(range);
    const changed =
      Math.abs(previous.from - next.from) > logicalRangeEpsilon ||
      Math.abs(previous.to - next.to) > logicalRangeEpsilon;

    this.visibleIndexRange = changed
      ? next
      : { ...previous, rightOffset: next.rightOffset };
    this.syncTimeScales();
    return changed;
  }

  private clampVisibleIndexRange(range: TimeScaleRange): TimeScaleRange {
    if (!Number.isFinite(range.from) || !Number.isFinite(range.to)) {
      throw new RangeError("Visible index range values must be finite.");
    }

    const boundsSpan = this.getIndexBoundsSpan();
    const requestedSpan = Math.max(range.to - range.from, 1);
    const span = Math.min(requestedSpan, boundsSpan);
    let from = range.from;
    let to = from + span;

    if (to > this.indexBounds.to) {
      to = this.indexBounds.to;
      from = to - span;
    }

    if (from < this.indexBounds.from) {
      from = this.indexBounds.from;
      to = from + span;
    }

    return {
      from,
      to,
      rightOffset: Math.max(0, to - this.model.length)
    };
  }

  private panInteractionByPixels(dx: number): void {
    const pixelsPerBar = this.getPixelsPerBar();
    if (pixelsPerBar <= 0) return;

    const delta = dx / pixelsPerBar;
    this.setVisibleIndexRange({
      from: this.visibleIndexRange.from - delta,
      to: this.visibleIndexRange.to - delta
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
    const anchorIndex = this.visibleIndexRange.from + anchorRatio * oldSpan;
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

  private createInteractionPointerEvent(
    type: ChartPointerEvent["type"],
    x: number,
    y: number,
    source?: PointerEvent | MouseEvent
  ): ChartPointerEvent | undefined {
    const state = this.resolveInteractionCrosshair(x, y);
    if (!state) return undefined;

    return {
      type,
      x,
      y: state.y,
      time: state.time,
      pane: state.pane,
      dataPoint: state.dataPoint,
      button: source?.button,
      buttons: source?.buttons
    };
  }

  private resolveInteractionDataPoint(
    x: number,
    y: number,
    scale: "data" | "visible"
  ): ChartData | undefined {
    if (!this.model.hasData()) return undefined;
    const rawPoint = (
      scale === "data" ? this.dataScale : this.visibleScale
    ).pixelToPoint(x, y, this.getContext("main").canvas);
    return this.findClosestDataPoint(rawPoint);
  }

  private resolveInteractionCrosshair(
    x: number,
    y: number
  ): ChartCrosshairState | undefined {
    const pointerY = Math.min(
      y,
      this.container.offsetHeight - this.xLabelHeight
    );
    const dataPoint = this.resolveInteractionDataPoint(x, pointerY, "visible");
    if (!dataPoint) return undefined;
    return {
      time: dataPoint.time,
      y: pointerY,
      pane: this.paneLayout.getPaneAtY(pointerY) ?? this.getMainPane(),
      dataPoint
    };
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

  private getCrosshairDefaultPrice(point: ChartData) {
    return point.close ?? point.open ?? point.high ?? point.low;
  }

  private resolveCrosshairY(
    options: ChartCrosshairOptions,
    pane: Pane,
    point: ChartData
  ) {
    const plotHeight = this.container.offsetHeight - this.xLabelHeight;
    if (options.y !== undefined) {
      return Math.max(0, Math.min(options.y, plotHeight));
    }

    const region = pane.getRegion();
    const price = options.price ?? this.getCrosshairDefaultPrice(point);
    if (price === undefined || price === null) {
      return region.y + region.height / 2;
    }

    return (
      region.y +
      pane.getPriceScale().project(price, {
        canvas: { width: region.width, height: region.height }
      })
    );
  }

  private resolveCrosshairState(
    options: ChartCrosshairOptions
  ): ChartCrosshairState | undefined {
    const dataPoint = this.model.getNearestData(options.time);
    if (!dataPoint) return undefined;

    const x = this.getTimeScale().project(dataPoint.time, {
      canvas: this.getContext("main").canvas,
      barAlignment: this.getTimeAnchorAlignment()
    });
    if (x < 0 || x > this.getDrawingSize().width) return undefined;

    const pane = this.paneLayout.getPaneById(options.paneId);
    const y = this.resolveCrosshairY(options, pane, dataPoint);

    return {
      time: dataPoint.time,
      y,
      pane,
      dataPoint
    };
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

  private findClosestDataPoint(rawPoint: ChartData): ChartData | undefined {
    const time = this.controller.getTimeFromRawDataPoint(rawPoint);
    return this.model.getNearestData(time);
  }

  getOutsideContainer() {
    return this.outsideContainer;
  }

  constructor(container: HTMLElement, options: ChartOptions) {
    super();
    this.defaultControllerConstructors =
      getDefaultControllerConstructors(options);
    const includeDefaultControllers =
      options.includeDefaultControllers ??
      this.defaultControllerConstructors.length > 0;
    this.registerConstructorOptions(options, includeDefaultControllers);
    this.options = this.resolveOptions(options, includeDefaultControllers);
    this.refreshOptionsSnapshot();
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

    if (this.options.timeRange === "auto") {
      this.timeRange = {
        start: 0,
        end: 0
      };
      this.autoTimeRange = true;
    } else {
      this.timeRange = { ...this.options.timeRange };
    }

    const ControllerClass = this.getControllerClass(this.options.type);

    this.controller = new ControllerClass(this, this.options);
    this.visibleScale = this.controller.createDataScale([], {
      start: 0,
      end: 0
    });
    this.applyPaneLayout({ resizeCanvases: false, resizeIndicators: false });
    this.renderer = new ChartRenderer(
      this.container,
      {
        getOptions: () => this.options,
        hasData: () => this.model.hasData(),
        getTimes: () => this.model.getTimes(),
        getVisibleData: () => this.lastVisibleDataPoints,
        getVisibleIndexRange: () => this.visibleIndexRange,
        getTimeRange: () => this.timeRange,
        getTimeScale: () => this.getTimeScale(),
        getVisibleScale: () => this.visibleScale,
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
    const topCanvas = this.renderer.getCanvas("crosshair");
    this.interactionController = new InteractionController(
      {
        hasData: () => this.model.hasData(),
        createPointerEvent: (type, x, y, source) =>
          this.createInteractionPointerEvent(type, x, y, source),
        dispatchPointer: (event) => this.dispatchInteractionPointer(event),
        resolveDataPoint: (x, y, scale) =>
          this.resolveInteractionDataPoint(x, y, scale),
        resolveCrosshair: (x, y) => this.resolveInteractionCrosshair(x, y),
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
    if (this.autoTimeRange) this.updateAutoTimeRange(true);
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

  private getDefaultLocaleValues(): LocaleValuesMap {
    return {
      default: {
        indicators: {
          actions: {
            show: "Show",
            hide: "Hide",
            settings: "Settings",
            remove: "Remove"
          }
        },
        common: {
          sources: {
            open: "open",
            high: "high",
            low: "low",
            close: "close",
            volume: "volume"
          }
        }
      }
    };
  }

  public getLocaleValues() {
    return (
      this.options.localeValues[this.options.locale] ||
      this.options.localeValues.default
    );
  }

  private updateAutoTimeRange(recalc = false) {
    const firstPoint = this.model.getDataAt(0)!;
    const lastPoint = this.model.getDataAt(this.model.length - 1)!;
    const stepCount = this.getMinimumVisibleIndexSlots();
    const endTime = Math.max(
      lastPoint.time + this.options.stepSize,
      firstPoint.time + stepCount * this.options.stepSize
    );
    this.timeRange = {
      start: firstPoint.time,
      end: endTime
    };
    if (recalc) {
      this.dataScale.recalculate(
        this.model.getData(),
        this.timeRange,
        this.getTimeScaleOptions()
      );
    }
  }

  private resetViewInteractionState() {
    this.visibleIndexRange = { from: 0, to: 1 };
    this.indexBounds = { from: 0, to: 1 };
    this.interactionController.reset();
  }

  private applyConfiguredTimeRange() {
    const configuredTimeRange = this.options.timeRange;
    this.autoTimeRange = configuredTimeRange === "auto";
    if (configuredTimeRange === "auto") {
      if (this.model.hasData()) {
        this.updateAutoTimeRange(false);
      } else {
        this.timeRange = { start: 0, end: 0 };
      }
    } else {
      this.timeRange = { ...configuredTimeRange };
    }
  }

  private rebuildScales(resetVisibleRange: boolean) {
    this.dataScale = this.controller.createDataScale(
      this.model.getData(),
      this.timeRange
    );
    this.visibleScale = this.controller.createDataScale([], {
      start: 0,
      end: 0
    });
    if (resetVisibleRange) this.resetVisibleIndexRange();
    this.syncTimeScales();
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
    const has = (key: ChartOptionKey) =>
      Object.prototype.hasOwnProperty.call(update, key);

    const type = update.type ?? this.options.type;
    const timeRange = update.timeRange ?? this.options.timeRange;
    const stepSize = update.stepSize ?? this.options.stepSize;
    const maxZoom = update.maxZoom ?? this.options.maxZoom;
    const volume = update.volume ?? this.options.volume;
    const formatter = update.formatter ?? this.options.formatter;
    const hasFormatter = update.formatter !== undefined;
    const locale =
      update.locale ??
      (hasFormatter ? formatter.getLocale() : this.options.locale);
    const timeZone = has("timeZone")
      ? update.timeZone
      : hasFormatter
        ? formatter.getTimeZone?.() ?? this.options.timeZone
        : this.options.timeZone;
    const theme = has("theme")
      ? snapshotOptionValue(mergeThemes(this.options.theme, update.theme))
      : this.options.theme;
    const localeValues = has("localeValues")
      ? snapshotOptionValue({
          ...this.getDefaultLocaleValues(),
          ...this.options.localeValues,
          ...(update.localeValues ?? {})
        })
      : this.options.localeValues;

    assertTimeRangeOption(timeRange);
    assertPositiveOption("stepSize", stepSize);
    assertPositiveOption("maxZoom", maxZoom);
    if (type !== this.options.type) this.getControllerClass(type);

    const changes: Array<[ChartOptionKey, boolean]> = [
      ["type", type !== this.options.type],
      ["timeRange", !timeRangeOptionsEqual(timeRange, this.options.timeRange)],
      ["stepSize", stepSize !== this.options.stepSize],
      ["maxZoom", maxZoom !== this.options.maxZoom],
      ["volume", volume !== this.options.volume],
      ["theme", !optionValuesEqual(theme, this.options.theme)],
      ["locale", locale !== this.options.locale],
      ["timeZone", timeZone !== this.options.timeZone],
      ["formatter", formatter !== this.options.formatter],
      [
        "localeValues",
        !optionValuesEqual(localeValues, this.options.localeValues)
      ]
    ];
    const changedKeys = changes
      .filter(([, changed]) => changed)
      .map(([key]) => key);
    if (changedKeys.length === 0) return;

    const previous = this.optionsSnapshot;
    const changed = new Set(changedKeys);
    const typeChanged = changed.has("type");
    const stepSizeChanged = changed.has("stepSize");
    const coreChanged = stepSizeChanged || changed.has("timeRange");
    const localizationChanged =
      changed.has("locale") ||
      changed.has("timeZone") ||
      changed.has("formatter") ||
      changed.has("localeValues");
    const previousThemeKey = this.options.theme.key;

    if (localizationChanged) {
      formatter.setLocale(locale);
      formatter.setTimeZone?.(timeZone);
    }
    this.options.type = type;
    this.options.timeRange =
      timeRange === "auto" ? "auto" : Object.freeze({ ...timeRange });
    this.options.stepSize = stepSize;
    this.options.maxZoom = maxZoom;
    this.options.volume = volume;
    this.options.theme = theme;
    this.options.locale = locale;
    this.options.timeZone = timeZone;
    this.options.formatter = formatter;
    this.options.localeValues = localeValues;
    this.refreshOptionsSnapshot();

    if (typeChanged) {
      const ControllerClass = this.getControllerClass(type);
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

    const event = {
      previous,
      current: this.optionsSnapshot,
      changedKeys: Object.freeze(changedKeys)
    } satisfies ChartOptionsChangeEvent;
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
    if (!this.model.hasData()) return this.timeRange;

    const startIndex = Math.max(
      0,
      Math.min(
        Math.floor(this.visibleIndexRange.from),
        this.model.length - 1
      )
    );
    const endIndex = Math.max(
      startIndex,
      Math.min(
        Math.ceil(this.visibleIndexRange.to) - 1,
        this.model.length - 1
      )
    );
    const startPoint = this.model.getDataAt(startIndex)!;
    const endPoint = this.model.getDataAt(endIndex)!;

    return {
      start: startPoint.time,
      end: endPoint.time + this.options.stepSize
    };
  }

  /**
   * Gets interpolated timestamps for the precise fractional logical window.
   * Use this representation for lossless pan/zoom replication.
   */
  public getVisibleTimeWindow(): TimeRange {
    if (!this.model.hasData()) return this.timeRange;

    const alignmentOffset = this.getBarAlignmentOffset();

    return {
      start: this.model.timeAtLogicalIndex(
        this.visibleIndexRange.from - alignmentOffset,
        this.options.stepSize
      ),
      end: this.model.timeAtLogicalIndex(
        this.visibleIndexRange.to - alignmentOffset,
        this.options.stepSize
      )
    };
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

    if (this.autoTimeRange) {
      this.updateAutoTimeRange(false);
    }

    this.dataScale = this.controller.createDataScale(
      this.model.getData(),
      this.timeRange
    );

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
    this.dataScale.addDataPoint(mappedPoint);

    if (this.autoTimeRange) {
      this.updateAutoTimeRange(true);
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
    if (this.autoTimeRange) {
      this.timeRange = { start: 0, end: 0 };
    }

    this.indexBounds = { from: 0, to: 1, rightOffset: 0 };
    this.visibleIndexRange = { ...this.indexBounds };
    this.lastVisibleDataPoints = Object.freeze([]);
    this.renderer.resetDerivedState();
    this.dataScale = this.controller.createDataScale([], this.timeRange);
    this.visibleScale.clearModifiers();
    this.visibleScale.recalculate(
      [],
      this.timeRange,
      this.getTimeScaleOptions()
    );
    this.syncTimeScales();
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
              this.visibleScale.getTimeScale()
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
            this.visibleScale.removeModifier(indicator);
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
    const state = this.resolveCrosshairState(options);
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

  private lastVisibleDataPoints: readonly ChartData[] = Object.freeze([]);

  recalculateVisibleScale() {
    this.refreshIndexBounds();
    const visibleTimeRange = this.getVisibleTimeRange();
    const visibleDataPoints = this.model.visibleData(
      this.visibleIndexRange.from - 1,
      this.visibleIndexRange.to + 1
    );

    for (const indicator of this.getIndicators()) {
      this.visibleScale.removeModifier(indicator);
      const modifier = indicator.getModifier(visibleTimeRange);
      if (modifier) {
        this.visibleScale.addModifier(modifier);
      }
    }

    // Do not recalc xMin and xMax to preserve x positions
    // but we need to adjust yMin and yMax to the visible data points
    this.visibleScale.recalculate(
      visibleDataPoints,
      this.timeRange,
      this.getTimeScaleOptions()
    );
    this.syncMainPanePriceScale();

    this.lastVisibleDataPoints = Object.freeze(visibleDataPoints);
    return this.lastVisibleDataPoints;
  }

  getLastVisibleDataPoints(): readonly ChartData[] {
    return this.lastVisibleDataPoints;
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
