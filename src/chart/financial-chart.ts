import {
  renderPriceAxisAnnotations,
  snapshotPriceAxisAnnotations,
  type PriceAxisAnnotation
} from "../annotations/price-axis-annotation";
import { ChartController } from "../controllers/controller";
import { DataStore } from "../data/data-store";
import type {
  PaneledIndicator,
  InitParams
} from "../indicators/paneled-indicator";
import {
  Indicator,
  restoreIndicator,
  type IndicatorInvalidationOptions,
  type IndicatorResolver,
  type IndicatorState,
  type IndicatorStateValue
} from "../indicators/indicator";
import {
  DataScaleModel,
  DataScaleTimeOptions
} from "../scales/data-scale-model";
import type { BarAlignment, TimeScaleRange } from "../scales/time-scale";
import {
  calculateStepSize as calculatePriceStepSize,
  calculateYAxisLabels as calculatePriceYAxisLabels
} from "../scales/ticks/price-ticks";
import { TimeTickGenerator } from "../scales/ticks/time-ticks";
import { DefaultFormatter, Formatter } from "./formatter";
import {
  ChartTheme,
  defaultLightTheme,
  mergeThemes,
  type ResolvedChartTheme
} from "./themes";
import { ChartData, type ChartDataValueKey, TimeRange } from "./types";
import { EventEmitter, type ChartEventMap } from "./event-emitter";
import { pixelRatio } from "../utils/screen";
import {
  bindEvent,
  createCanvasLayer,
  createPositionedContainer,
  type Dispose,
  resizeCanvasLayer,
  scaleCanvasContext
} from "../utils/dom";
import type {
  ChartDOMOverlay,
  ChartDOMAdapter,
  PaneDividerHandle,
  PaneDividerModel
} from "../ui/chart-dom-adapter";
import { DefaultDOMAdapter } from "../ui/default-dom-adapter";
import {
  RenderCallback,
  RenderLayer,
  RenderPipeline,
  RenderStage
} from "../render/render-pipeline";
import { Pane } from "../panes/pane";
import type {
  ChartContext,
  ChartPlugin,
  ChartPointerEvent
} from "../plugin/chart-plugin";
import { getDefaultControllerConstructors } from "./internal-default-controllers";
import { cloneJSONStateValue, isPlainRecord } from "../utils/json-state";

const logicalRangeEpsilon = 1e-9;
const crosshairLabelIndex: Record<ChartDataValueKey, number> = {
  open: 0,
  high: 1,
  low: 2,
  close: 3,
  volume: 4
};

type DeepReadonly<T> = T extends Function
  ? T
  : T extends object
    ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
    : T;

export type ControllerID =
  | "area"
  | "line"
  | "candle"
  | "bar"
  | "hollow-candle"
  | "stepline"
  | "hlc-area";
export type ControllerType = ControllerID | (string & {});

export interface LocaleValues {
  common: {
    sources: {
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    };
  };
  indicators: {
    actions: {
      show: string;
      hide: string;
      settings: string;
      remove: string;
    };
  };
}

export type LocaleValuesMap = {
  [key: string]: LocaleValues;
};

export interface ChartLocalizationOptions {
  locale?: string;
  timeZone?: string;
  formatter?: Formatter;
  localeValues?: LocaleValuesMap;
}

/** Runtime options accepted by `FinancialChart.updateOptions()`. */
export interface ChartOptionsUpdate extends ChartLocalizationOptions {
  type?: ControllerType;
  timeRange?: TimeRange | "auto";
  stepSize?: number;
  maxZoom?: number;
  volume?: boolean;
  theme?: ChartTheme;
}

export type ChartOptionKey = keyof ChartOptionsUpdate;

export interface ControllerConstructor {
  new (
    chart: FinancialChart,
    options: ResolvedChartOptions
  ): ChartController;
  readonly ID: string;
}

export interface ChartOptions {
  type?: ControllerType;
  timeRange?: TimeRange | "auto";
  stepSize: number;
  maxZoom?: number;
  volume?: boolean;
  controllers?: readonly ControllerConstructor[];
  /**
   * Controls registration of class-provided defaults. Use the core entry to
   * exclude unused controllers from application bundles.
   */
  includeDefaultControllers?: boolean;
  locale?: string;
  timeZone?: string;
  formatter?: Formatter;
  theme?: ChartTheme;
  domAdapter?: ChartDOMAdapter;
  localeValues?: LocaleValuesMap;
}

/** Fully resolved options supplied to controller instances. */
export interface ResolvedChartOptions {
  readonly type: ControllerType;
  readonly timeRange: TimeRange | "auto";
  readonly stepSize: number;
  readonly maxZoom: number;
  readonly volume: boolean;
  readonly controllers: readonly ControllerConstructor[];
  readonly includeDefaultControllers: boolean;
  readonly locale: string;
  readonly timeZone?: string;
  readonly formatter: Formatter;
  readonly theme: ResolvedChartTheme;
  readonly domAdapter: ChartDOMAdapter;
  readonly localeValues: LocaleValuesMap;
}

/** Immutable public snapshot returned by `FinancialChart.getOptions()`. */
export interface ChartOptionsSnapshot {
  readonly type: ControllerType;
  readonly timeRange: DeepReadonly<TimeRange> | "auto";
  readonly stepSize: number;
  readonly maxZoom: number;
  readonly volume: boolean;
  readonly controllers: readonly ControllerConstructor[];
  readonly includeDefaultControllers: boolean;
  readonly locale: string;
  readonly timeZone?: string;
  readonly theme: DeepReadonly<ResolvedChartTheme>;
  readonly localeValues: DeepReadonly<LocaleValuesMap>;
}

export interface ChartOptionsState {
  readonly type: ControllerType;
  readonly timeRange: DeepReadonly<TimeRange> | "auto";
  readonly stepSize: number;
  readonly maxZoom: number;
  readonly volume: boolean;
  readonly theme: DeepReadonly<ResolvedChartTheme>;
  readonly locale: string;
  readonly timeZone?: string;
  readonly formatter: Formatter;
  readonly localeValues: DeepReadonly<LocaleValuesMap>;
}

export interface ChartOptionsChangeEvent {
  readonly previous: ChartOptionsState;
  readonly current: ChartOptionsState;
  readonly changedKeys: readonly ChartOptionKey[];
}

export const CHART_STATE_VERSION = 1 as const;

/** Runtime chart options that affect data mapping and the primary series. */
export interface ChartCoreState {
  type: ControllerType;
  timeRange: TimeRange | "auto";
  stepSize: number;
  maxZoom: number;
  volume: boolean;
}

export interface ChartPaneState {
  /** Stable pane identity used by drawings and other pane-owned state. */
  id: number;
  height: number;
  /** The paneled indicator that owns this pane; absent for the main pane. */
  indicatorInstanceId?: string;
}

/** Versioned, JSON-safe chart configuration and view state. */
export interface ChartState {
  version: typeof CHART_STATE_VERSION;
  core: ChartCoreState;
  visibleRange: TimeRange;
  panes: readonly ChartPaneState[];
  indicators: readonly IndicatorState[];
  contributions?: Readonly<Record<string, IndicatorStateValue>>;
}

export interface ChartStateContributor<TState = unknown> {
  /** Unique persistence key stored under `ChartState.contributions`. */
  readonly key: string;
  toJSON(): TState;
  fromJSON(state: TState): unknown;
}

export interface ChartStateSerializationOptions {
  contributors?: readonly ChartStateContributor[];
}

export interface ChartStateRestoreOptions extends ChartStateSerializationOptions {
  indicatorResolver?: IndicatorResolver;
}

export interface ChartStateRestoredEvent {
  /** Final normalized state after all contributors have been restored. */
  state: ChartState;
}

type MutableResolvedChartOptions = {
  -readonly [P in keyof ResolvedChartOptions]: ResolvedChartOptions[P];
};

type Resizer = {
  resize: (force: boolean) => void;
  ratioResize: () => void;
};

export type ChartCanvasLayer =
  | "main"
  | "crosshair"
  | "x-label"
  | "y-label"
  | "indicator"
  | "drawings";

type ChartOwnedCanvasLayer = ChartCanvasLayer | "annotations";

export type ChartRedrawPart = RenderLayer;
export type PaneHeightsInput =
  | Partial<Record<number, number>>
  | readonly number[];

export interface ChartCrosshairOptions {
  /** Timestamp to resolve on the target chart. The nearest data point is used. */
  time: number;
  /** Chart-relative logical Y coordinate. */
  y?: number;
  /** Price to project inside the target pane when `y` is omitted. */
  price?: number;
  /** Target pane id. Defaults to the main pane. */
  paneId?: number;
}

export interface ChartCrosshairState {
  time: number;
  y: number;
  pane: Pane;
  dataPoint: ChartData;
}

export interface IndicatorMutationOptions {
  emit?: boolean;
}

type PaneResizeDrag = {
  dividerIndex: number;
  startClientY: number;
  beforeStartHeight: number;
  afterStartHeight: number;
  disposers: Dispose[];
};

interface OptionsUpdateBehavior {
  emit?: boolean;
  notifyExtensions?: boolean;
  redraw?: boolean;
}

export class FinancialChart extends EventEmitter {
  private readonly types: readonly ChartOwnedCanvasLayer[] = [
    "main",
    "crosshair",
    "x-label",
    "y-label",
    "indicator",
    "drawings",
    "annotations"
  ] as const;
  private readonly controllers = new Map<
    ControllerType,
    ControllerConstructor
  >();
  private controller: ChartController;
  protected outsideContainer: HTMLElement;
  protected container: HTMLElement;
  protected indicatorLabelContainer: HTMLElement;
  protected canvases: Map<string, HTMLCanvasElement> = new Map();
  protected contexts: Map<string, CanvasRenderingContext2D> = new Map();
  protected isPanning: boolean = false;
  protected dataStore = new DataStore();
  private originalDataStore = new DataStore();
  protected options!: MutableResolvedChartOptions;
  private optionsSnapshot!: ChartOptionsSnapshot;
  private readonly defaultControllerConstructors: readonly ControllerConstructor[];
  protected visibleIndexRange: TimeScaleRange = { from: 0, to: 1 };
  private indexBounds: TimeScaleRange = { from: 0, to: 1 };
  protected timeRange!: TimeRange;
  protected autoTimeRange = false;
  protected dataScale!: DataScaleModel;
  protected visibleScale: DataScaleModel;
  private resizer!: Resizer;
  private domAdapter: ChartDOMAdapter;
  private overlay!: ChartDOMOverlay;
  private readonly renderPipeline = new RenderPipeline();
  private readonly mainPane = new Pane(0);
  private readonly panes: Pane[] = [this.mainPane];
  private nextPaneId = 1;
  private readonly paneByIndicator = new Map<
    PaneledIndicator<any, any>,
    Pane
  >();
  private readonly indicatorByPane = new Map<
    Pane,
    PaneledIndicator<any, any>
  >();
  private readonly paneHeights = new Map<Pane, number>();
  private paneHeightsCustomized = false;
  private readonly paneDividerHandles: PaneDividerHandle[] = [];
  private paneResizeDrag?: PaneResizeDrag;
  private restoringState = false;
  private restoringPaneIds?: ReadonlyMap<string, number>;
  private pendingRestoredVisibleRange?: TimeRange;

  private readonly indicators: Indicator<any, any>[] = [];
  private readonly paneledIndicators: PaneledIndicator<any, any>[] = [];
  private readonly plugins: ChartPlugin[] = [];
  private readonly priceAxisAnnotations = new Map<
    ChartPlugin,
    readonly PriceAxisAnnotation[]
  >();
  private readonly extensionAbortControllers = new WeakMap<
    ChartPlugin,
    AbortController
  >();
  private disposed = false;

  protected yLabelWidth = 80;
  protected xLabelHeight = 30;
  protected mainPaneMinHeight = 80;
  protected indicatorPaneMinHeight = 50;
  protected paneDividerHeight = 8;

  protected pointerTime = -1;
  protected crosshairDataPoint: ChartData | null = null;
  protected pointerY = -1;
  protected pointerPane: Pane = this.mainPane;
  private isProgrammaticCrosshair = false;
  private pointerGestureConsumed = false;

  private lastTouchDistance?: number;
  private lastPointerPosition?: { x: number };
  private resizeObserver: ResizeObserver;
  private readonly eventDisposers: Array<() => void> = [];

  private isTouchCrosshair = false;
  private isTouchCrosshairTimeout?: any;

  private isTouchCapable = "ontouchstart" in window;

  private readonly timeTickGenerator = new TimeTickGenerator();
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

  private lastXGridCoords: readonly number[] = Object.freeze([]);

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
    this.options.controllers = [...this.controllers.values()];
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
    assertTimeRange(timeRange);
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
      timeRange,
      stepSize: options.stepSize,
      maxZoom: options.maxZoom ?? 100,
      volume: options.volume ?? true,
      controllers: [...this.controllers.values()],
      includeDefaultControllers,
      locale,
      timeZone,
      formatter,
      theme: mergeThemes(defaultLightTheme, options.theme),
      domAdapter: options.domAdapter ?? new DefaultDOMAdapter(),
      localeValues: {
        ...this.getDefaultLocaleValues(),
        ...options.localeValues
      }
    };
  }

  private refreshOptionsSnapshot() {
    this.optionsSnapshot = Object.freeze({
      type: this.options.type,
      timeRange:
        this.options.timeRange === "auto"
          ? "auto"
          : Object.freeze({ ...this.options.timeRange }),
      stepSize: this.options.stepSize,
      maxZoom: this.options.maxZoom,
      volume: this.options.volume,
      controllers: Object.freeze([...this.options.controllers]),
      includeDefaultControllers: this.options.includeDefaultControllers,
      locale: this.options.locale,
      timeZone: this.options.timeZone,
      theme: cloneAndFreeze(this.options.theme),
      localeValues: cloneAndFreeze(this.options.localeValues)
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
    return this.mainPane.getPriceScale();
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
    const contributorMap = indexStateContributors(options.contributors ?? []);
    const contributions: Record<string, IndicatorStateValue> = {};
    for (const [key, contributor] of contributorMap) {
      contributions[key] = cloneJSONStateValue(
        contributor.toJSON(),
        `Chart state contribution "${key}"`
      );
    }

    const configuredTimeRange = this.options.timeRange;
    const state: ChartState = {
      version: CHART_STATE_VERSION,
      core: {
        type: this.options.type,
        timeRange:
          configuredTimeRange === "auto" ? "auto" : { ...configuredTimeRange },
        stepSize: this.options.stepSize,
        maxZoom: this.options.maxZoom,
        volume: this.options.volume
      },
      visibleRange: {
        ...(this.pendingRestoredVisibleRange ?? this.getVisibleTimeWindow())
      },
      panes: this.panes.map((pane) => {
        const indicator = this.indicatorByPane.get(pane);
        return {
          id: pane.getId(),
          height: this.paneHeights.get(pane) ?? pane.getRegion().height,
          ...(indicator
            ? { indicatorInstanceId: indicator.getInstanceId() }
            : {})
        };
      }),
      indicators: this.getAllIndicators().map((indicator) => indicator.toJSON())
    };

    if (Object.keys(contributions).length > 0) {
      state.contributions = contributions;
    }
    return state;
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
    this.restoringState = true;
    this.restoringPaneIds = paneIdsByIndicator;
    try {
      for (const indicator of [...this.getAllIndicators()]) {
        this.removeIndicator(indicator, { emit: false });
      }

      optionsEvent = this.applyOptionsUpdate(validatedState.core, {
        emit: false,
        notifyExtensions: false,
        redraw: false
      });

      if (this.dataStore.length > 0) {
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

      if (this.dataStore.length > 0) {
        this.recalculateVisibleScale();
      }
      this.notifyPluginsAfterStateRestore(optionsEvent);
    } finally {
      this.restoringPaneIds = undefined;
      this.restoringState = false;
      this.requestRedraw(this.allRedrawParts);
    }

    this.emit("state-restored", {
      state: this.toJSON({ contributors: restoredContributors })
    });
  }

  /** Returns the stable frozen snapshot for the current mapped dataset. */
  getData(): readonly ChartData[] {
    return this.dataStore.snapshot();
  }

  private getTimeScaleOptions(): DataScaleTimeOptions {
    return {
      barAlignment: this.controller.getBarAlignment(),
      indexRange: this.visibleIndexRange,
      timeValues: this.dataStore.times()
    };
  }

  private syncTimeScales() {
    const options = this.getTimeScaleOptions();
    this.visibleScale.configureTimeScale(options);
    if (this.dataScale) {
      this.dataScale.configureTimeScale(options);
    }
    const timeAnchorAlignment = this.getTimeAnchorAlignment();
    for (const pane of this.panes) {
      pane.setTimeScale(this.visibleScale.getTimeScale());
      pane.setTimeAnchorAlignment(timeAnchorAlignment);
    }
  }

  private syncMainPanePriceScale() {
    this.mainPane.setPriceRange(
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
    if (this.dataStore.length === 0) {
      return { from: 0, to: 1, rightOffset: 0 };
    }

    if (this.autoTimeRange) {
      const slotCount = Math.max(
        this.dataStore.length,
        this.getMinimumVisibleIndexSlots()
      );

      return {
        from: 0,
        to: slotCount,
        rightOffset: Math.max(0, slotCount - this.dataStore.length)
      };
    }

    const range = this.dataStore.indexRangeForTimeRange(
      this.timeRange.start,
      this.timeRange.end
    );

    return {
      from: range.from,
      to: range.to,
      rightOffset: Math.max(0, range.to - this.dataStore.length)
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
    if (this.dataStore.length === 0) return;
    this.applyVisibleIndexRange(range);
  }

  /**
   * Selects whole bars whose timestamps fall in `[start, end)`.
   * This is a no-op while the chart has no data.
   *
   * @throws {RangeError} when either boundary is not finite
   */
  public setVisibleTimeRange(range: TimeRange): void {
    if (this.dataStore.length === 0) return;
    this.assertFiniteVisibleTimeRange(range);
    const end = Math.max(range.start, range.end - 1);
    this.setVisibleIndexRange(
      this.dataStore.indexRangeForTimeRange(range.start, end)
    );
  }

  /**
   * Sets a precise timestamp window while preserving fractional bar indexes.
   * This is a no-op while the chart has no data.
   *
   * @throws {RangeError} when either boundary is not finite
   */
  public setVisibleTimeWindow(range: TimeRange): void {
    if (this.dataStore.length === 0) return;
    this.assertFiniteVisibleTimeRange(range);

    this.setVisibleIndexRange(this.resolveVisibleTimeWindow(range));
  }

  private resolveVisibleTimeWindow(range: TimeRange): TimeScaleRange {
    this.assertFiniteVisibleTimeRange(range);

    const alignmentOffset = this.getBarAlignmentOffset();
    const from =
      this.dataStore.logicalIndexForTime(range.start, this.options.stepSize) +
      alignmentOffset;
    const to =
      this.dataStore.logicalIndexForTime(range.end, this.options.stepSize) +
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
    this.notifyExtensionsVisibleRangeChanged();
    this.requestRedraw(this.viewRedrawParts);
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
      rightOffset: Math.max(0, to - this.dataStore.length)
    };
  }

  private panVisibleIndexRange(dx: number) {
    const pixelsPerBar = this.getPixelsPerBar();
    if (pixelsPerBar <= 0) return;

    const delta = dx / pixelsPerBar;
    this.setVisibleIndexRange({
      from: this.visibleIndexRange.from - delta,
      to: this.visibleIndexRange.to - delta
    });
  }

  private zoomVisibleIndexRangeAtPixel(pixel: number, zoomFactor: number) {
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
    return freezeSnapshot([...this.indicators]);
  }

  getPaneledIndicators(): readonly PaneledIndicator<any, any>[] {
    return freezeSnapshot([...this.paneledIndicators]);
  }

  getAllIndicators(): readonly Indicator<any, any>[] {
    return freezeSnapshot([...this.indicators, ...this.paneledIndicators]);
  }

  /** Returns an attached indicator by its unique instance identity. */
  getIndicatorById(instanceId: string): Indicator<any, any> | undefined {
    return (
      this.indicators.find(
        (indicator) => indicator.getInstanceId() === instanceId
      ) ??
      this.paneledIndicators.find(
        (indicator) => indicator.getInstanceId() === instanceId
      )
    );
  }

  /** Returns all attached indicators sharing a factory/type identity. */
  getIndicatorsByType(typeId: string): readonly Indicator<any, any>[] {
    return freezeSnapshot(
      [...this.indicators, ...this.paneledIndicators].filter(
        (indicator) => indicator.getIndicatorType() === typeId
      )
    );
  }

  getPanes(): readonly Pane[] {
    return freezeSnapshot([...this.panes]);
  }

  getMainPane() {
    return this.mainPane;
  }

  getPaneHeights(): Record<number, number> {
    return Object.fromEntries(
      this.panes.map((pane) => [
        pane.getId(),
        this.paneHeights.get(pane) ?? pane.getRegion().height
      ])
    );
  }

  setPaneHeights(heights: PaneHeightsInput): void {
    const desired = new Map(this.paneHeights);

    this.panes.forEach((pane, index) => {
      const value = Array.isArray(heights)
        ? heights[index]
        : heights[pane.getId()];
      if (value == undefined) return;
      desired.set(pane, value);
    });

    this.paneHeightsCustomized = true;
    this.normalizePaneHeights(desired);
    this.applyPaneLayout({ redraw: true, immediate: true });
  }

  getPlugins(): readonly ChartPlugin[] {
    return freezeSnapshot([...this.plugins]);
  }

  addPlugin(plugin: ChartPlugin): () => void {
    if (this.disposed) {
      throw new Error("Cannot add a plugin to a disposed chart.");
    }
    if (this.plugins.includes(plugin)) {
      throw new Error("Plugin instance is already attached to this chart.");
    }
    if (this.plugins.some((item) => item.key === plugin.key)) {
      throw new Error(
        `Plugin key "${plugin.key}" is already registered on this chart.`
      );
    }

    this.plugins.push(plugin);
    try {
      plugin.attach(this.createChartContext(plugin));
      this.deliverInitialExtensionState(plugin);
      this.requestRedraw(this.allRedrawParts);
    } catch (error) {
      this.disposeExtensionScope(plugin);
      const index = this.plugins.indexOf(plugin);
      if (index !== -1) this.plugins.splice(index, 1);
      throw error;
    }

    return () => {
      this.removePlugin(plugin);
    };
  }

  removePlugin(plugin: ChartPlugin): boolean {
    const index = this.plugins.indexOf(plugin);
    if (index === -1) return false;

    this.plugins.splice(index, 1);
    this.disposeExtensionScope(plugin);
    try {
      plugin.detach?.();
    } finally {
      this.requestRedraw(this.allRedrawParts);
    }
    return true;
  }

  public emit<K extends keyof ChartEventMap>(event: K, data: ChartEventMap[K]) {
    super.emit(event, data);

    if (event === "drawing-finished") {
      this.notifyExtensionsDrawingFinished(
        data as ChartEventMap["drawing-finished"]
      );
    } else if (event === "options-change") {
      this.notifyExtensionsOptionsChanged(
        data as ChartEventMap["options-change"]
      );
    }
  }

  private createChartContext(extension: ChartPlugin): ChartContext {
    const abortController = new AbortController();
    const { signal } = abortController;
    const scoped = (dispose: () => void) =>
      this.createExtensionScopedDisposer(signal, dispose);
    this.extensionAbortControllers.set(extension, abortController);
    return {
      chart: this,
      domAdapter: this.domAdapter,
      signal,
      emit: (event, data) => this.emit(event, data),
      getCanvasContext: (layer) => this.getContext(layer),
      getLogicalCanvas: (layer) => this.getLogicalCanvas(layer),
      getPanes: () => this.getPanes(),
      getPlugin: <TPlugin extends ChartPlugin = ChartPlugin>(key: string) =>
        this.plugins.find((plugin) => plugin.key === key) as
          | TPlugin
          | undefined,
      getPlugins: () => this.getPlugins(),
      getVisibleTimeWindow: () => this.getVisibleTimeWindow(),
      getVisibleTimeRange: () => this.getVisibleTimeRange(),
      on: (event, listener) => scoped(this.on(event, listener)),
      onRenderStage: (stage, callback) =>
        scoped(this.onRenderStage(stage, callback)),
      requestRedraw: (part, immediate) => this.requestRedraw(part, immediate),
      setPriceAxisAnnotations: (annotations) =>
        this.setPriceAxisAnnotations(extension, annotations),
      clearPriceAxisAnnotations: () =>
        this.setPriceAxisAnnotations(extension, []),
      setCrosshair: (options) => this.setCrosshair(options),
      clearCrosshair: () => this.clearCrosshair()
    };
  }

  private createExtensionScopedDisposer(
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

  private disposeExtensionScope(extension: ChartPlugin) {
    this.extensionAbortControllers.get(extension)?.abort();
    this.extensionAbortControllers.delete(extension);
    this.priceAxisAnnotations.delete(extension);
  }

  private setPriceAxisAnnotations(
    extension: ChartPlugin,
    annotations: readonly PriceAxisAnnotation[]
  ) {
    const scope = this.extensionAbortControllers.get(extension);
    if (!scope || scope.signal.aborted) return;

    const snapshot = snapshotPriceAxisAnnotations(annotations);
    if (snapshot.length === 0) {
      if (!this.priceAxisAnnotations.delete(extension)) return;
    } else {
      this.priceAxisAnnotations.set(extension, snapshot);
    }
    this.requestRedraw("annotations");
  }

  private getLifecycleExtensions(): ChartPlugin[] {
    return [...this.indicators, ...this.paneledIndicators, ...this.plugins];
  }

  private getPointerExtensions(): ChartPlugin[] {
    return [
      ...[...this.plugins].reverse(),
      ...[...this.paneledIndicators].reverse(),
      ...[...this.indicators].reverse()
    ];
  }

  private isExtensionAttached(extension: ChartPlugin) {
    return (
      this.plugins.includes(extension) ||
      this.indicators.includes(extension as Indicator<any, any>) ||
      this.paneledIndicators.includes(
        extension as PaneledIndicator<any, any>
      )
    );
  }

  private forEachLifecycleExtension(
    notify: (extension: ChartPlugin) => void
  ) {
    const extensions = this.getLifecycleExtensions();
    for (const extension of extensions) {
      if (this.isExtensionAttached(extension)) notify(extension);
    }
  }

  private createInitialOptionsChangeEvent(): ChartOptionsChangeEvent {
    const current = this.createOptionsState();
    return Object.freeze({
      previous: current,
      current,
      changedKeys: Object.freeze([])
    });
  }

  private deliverInitialExtensionState(extension: ChartPlugin) {
    if (!this.isExtensionAttached(extension)) return;
    extension.onOptionsChanged?.(this.createInitialOptionsChangeEvent());
    if (!this.isExtensionAttached(extension)) return;
    extension.onData?.(this.dataStore.snapshot());
    if (!this.isExtensionAttached(extension)) return;
    extension.onVisibleRangeChanged?.(this.getVisibleTimeRange());
  }

  private notifyExtensionsData(data: readonly ChartData[]) {
    this.forEachLifecycleExtension((extension) => {
      extension.onData?.(data);
    });
  }

  private notifyExtensionsVisibleRangeChanged() {
    const range = this.getVisibleTimeRange();
    this.forEachLifecycleExtension((extension) => {
      extension.onVisibleRangeChanged?.(range);
    });
  }

  private notifyExtensionsOptionsChanged(event: ChartOptionsChangeEvent) {
    this.forEachLifecycleExtension((extension) => {
      const indicator = extension as Indicator<any, any>;
      if (
        this.indicators.includes(indicator) ||
        this.paneledIndicators.includes(
          indicator as PaneledIndicator<any, any>
        )
      ) {
        indicator.applyChartOptions(event);
      }
      if (!this.isExtensionAttached(extension)) return;
      extension.onOptionsChanged?.(event);
    });
  }

  private notifyPluginsAfterStateRestore(event?: ChartOptionsChangeEvent) {
    const data = this.dataStore.snapshot();
    const visibleRange = this.getVisibleTimeRange();
    for (const plugin of [...this.plugins]) {
      if (!this.isExtensionAttached(plugin)) continue;
      if (event) plugin.onOptionsChanged?.(event);
      if (!this.isExtensionAttached(plugin)) continue;
      plugin.onData?.(data);
      if (!this.isExtensionAttached(plugin)) continue;
      plugin.onVisibleRangeChanged?.(visibleRange);
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
        if (pane.id !== this.mainPane.getId() || hasMainPane) {
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

  private notifyExtensionsPointer(event: ChartPointerEvent) {
    for (const extension of this.getPointerExtensions()) {
      if (!this.isExtensionAttached(extension)) continue;
      if (extension.onPointer?.(event) === true) return true;
    }

    return false;
  }

  private notifyExtensionsDrawingFinished(
    event: ChartEventMap["drawing-finished"]
  ) {
    this.forEachLifecycleExtension((extension) => {
      extension.onDrawingFinished?.(event);
    });
  }

  private createPluginPointerEvent(
    type: ChartPointerEvent["type"],
    x: number,
    y: number,
    source?: PointerEvent | MouseEvent
  ): ChartPointerEvent | undefined {
    if (this.dataStore.length === 0) return undefined;

    const pointerY = Math.min(
      y,
      this.container.offsetHeight - this.xLabelHeight
    );
    const rawPoint = this.visibleScale.pixelToPoint(
      x,
      pointerY,
      this.getContext("main").canvas
    );
    const closestDataPoint = this.findClosestDataPoint(rawPoint);
    if (!closestDataPoint) return undefined;

    return {
      type,
      x,
      y: pointerY,
      time: closestDataPoint.time,
      pane: this.getPaneAtY(pointerY) ?? this.mainPane,
      dataPoint: closestDataPoint,
      button: source?.button,
      buttons: source?.buttons
    };
  }

  private beforeDrawPlugins() {
    for (const plugin of this.plugins) {
      plugin.beforeDraw?.();
    }
  }

  private drawPlugins() {
    for (const plugin of this.plugins) {
      plugin.draw?.();
    }
  }

  private afterDrawPlugins() {
    for (const plugin of this.plugins) {
      plugin.afterDraw?.();
    }
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

  private createPaneForIndicator(indicator: PaneledIndicator<any, any>) {
    const restoredPaneId = this.restoringPaneIds?.get(
      indicator.getInstanceId()
    );
    const paneId = restoredPaneId ?? this.nextPaneId;
    this.nextPaneId = Math.max(this.nextPaneId, paneId + 1);
    const pane = new Pane(paneId);
    pane.setTimeScale(this.visibleScale.getTimeScale());
    this.panes.push(pane);
    this.paneByIndicator.set(indicator, pane);
    this.indicatorByPane.set(pane, indicator);
    return pane;
  }

  private removePaneForIndicator(indicator: PaneledIndicator<any, any>) {
    const pane = this.paneByIndicator.get(indicator);
    if (!pane) return;

    this.paneByIndicator.delete(indicator);
    this.indicatorByPane.delete(pane);
    this.panes.splice(this.panes.indexOf(pane), 1);
    if (this.pointerPane === pane) {
      this.pointerPane = this.mainPane;
    }
  }

  private getPaneLayoutHeight() {
    return Math.max(0, this.container.offsetHeight - this.xLabelHeight);
  }

  private getPaneMinHeight(pane: Pane) {
    return pane === this.mainPane
      ? this.mainPaneMinHeight
      : this.indicatorPaneMinHeight;
  }

  private getDefaultIndicatorPaneHeight(totalHeight: number) {
    const indicatorCount = this.paneledIndicators.length;
    if (indicatorCount === 0) return 0;

    const canUseQuarter =
      totalHeight / (indicatorCount + 1) > totalHeight * 0.25;

    return canUseQuarter
      ? totalHeight * 0.25
      : (totalHeight * 0.75) / indicatorCount;
  }

  private resetDefaultPaneHeights(totalHeight: number) {
    const indicatorHeight = this.getDefaultIndicatorPaneHeight(totalHeight);
    const desired = new Map<Pane, number>();
    desired.set(
      this.mainPane,
      totalHeight - indicatorHeight * this.paneledIndicators.length
    );

    for (const indicator of this.paneledIndicators) {
      const pane = this.paneByIndicator.get(indicator);
      if (pane) desired.set(pane, indicatorHeight);
    }

    this.normalizePaneHeights(desired, totalHeight);
  }

  private normalizePaneHeights(
    desired: Map<Pane, number>,
    totalHeight = this.getPaneLayoutHeight()
  ) {
    const panes = this.panes;
    const next = new Map<Pane, number>();
    if (panes.length === 0) return;

    const minHeightSum = panes.reduce(
      (sum, pane) => sum + this.getPaneMinHeight(pane),
      0
    );
    const minScale =
      minHeightSum > 0 && minHeightSum > totalHeight
        ? totalHeight / minHeightSum
        : 1;
    const getEffectiveMinHeight = (pane: Pane) =>
      this.getPaneMinHeight(pane) * minScale;

    for (const pane of panes) {
      const fallback =
        pane === this.mainPane
          ? totalHeight
          : this.getDefaultIndicatorPaneHeight(totalHeight);
      const height =
        desired.get(pane) ?? this.paneHeights.get(pane) ?? fallback;
      next.set(
        pane,
        Math.max(
          getEffectiveMinHeight(pane),
          Number.isFinite(height) ? height : 0
        )
      );
    }

    let delta =
      totalHeight - [...next.values()].reduce((sum, height) => sum + height, 0);

    if (delta > 0) {
      next.set(this.mainPane, (next.get(this.mainPane) ?? 0) + delta);
    } else if (delta < 0) {
      let remaining = -delta;
      const shrinkOrder = [
        this.mainPane,
        ...panes.filter((pane) => pane !== this.mainPane).reverse()
      ];

      for (const pane of shrinkOrder) {
        if (remaining <= 0) break;
        const minHeight = getEffectiveMinHeight(pane);
        const height = next.get(pane) ?? minHeight;
        const shrink = Math.min(height - minHeight, remaining);
        if (shrink <= 0) continue;
        next.set(pane, height - shrink);
        remaining -= shrink;
      }

      if (remaining > 0 && totalHeight > 0) {
        const currentTotal = [...next.values()].reduce(
          (sum, height) => sum + height,
          0
        );
        const scale = totalHeight / currentTotal;
        for (const pane of panes) {
          next.set(pane, (next.get(pane) ?? 0) * scale);
        }
      }
    }

    this.paneHeights.clear();
    for (const pane of panes) {
      this.paneHeights.set(pane, next.get(pane) ?? 0);
    }
  }

  private layoutPanes() {
    const totalHeight = this.getPaneLayoutHeight();
    const width = Math.max(0, this.container.offsetWidth - this.yLabelWidth);

    if (!this.paneHeightsCustomized) {
      this.resetDefaultPaneHeights(totalHeight);
    } else {
      this.normalizePaneHeights(this.paneHeights, totalHeight);
    }

    let y = 0;
    for (const pane of this.panes) {
      const height = this.paneHeights.get(pane) ?? 0;
      pane.setRegion({
        x: 0,
        y,
        width,
        height
      });
      pane.setYAxisRegion({
        x: width,
        y,
        width: this.yLabelWidth,
        height
      });
      y += height;
    }

    this.updatePaneDividers();
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
    this.layoutPanes();

    if (resizeCanvases) {
      this.resizeCanvases();
    }

    if (resizeIndicators) {
      for (const indicator of this.paneledIndicators) {
        const pane = this.paneByIndicator.get(indicator);
        if (!pane) continue;
        indicator.resize(this.getPaneInitParams(pane));
      }
    }

    if (redraw) {
      this.requestRedraw(this.allRedrawParts, immediate);
    }
  }

  private createPaneDividerHandle(
    model: PaneDividerModel,
    dividerIndex: number
  ) {
    const fallbackAdapter = new DefaultDOMAdapter();
    const createPaneDivider =
      this.domAdapter.createPaneDivider?.bind(this.domAdapter) ??
      fallbackAdapter.createPaneDivider.bind(fallbackAdapter);

    return createPaneDivider(model, {
      onPointerDown: (event) => this.startPaneResize(dividerIndex, event)
    });
  }

  private updatePaneDividers() {
    const dividerCount = Math.max(0, this.panes.length - 1);

    while (this.paneDividerHandles.length > dividerCount) {
      this.paneDividerHandles.pop()?.destroy();
    }

    for (let index = 0; index < dividerCount; index++) {
      const beforePane = this.panes[index];
      const afterPane = this.panes[index + 1];
      const beforeRegion = beforePane.getRegion();
      const model: PaneDividerModel = {
        key: `pane-divider-${beforePane.getId()}-${afterPane.getId()}`,
        themeKey: this.options.theme.key,
        beforePaneId: beforePane.getId(),
        afterPaneId: afterPane.getId(),
        x: 0,
        y: beforeRegion.y + beforeRegion.height - this.paneDividerHeight / 2,
        width: this.container.offsetWidth,
        height: this.paneDividerHeight
      };

      let handle = this.paneDividerHandles[index];
      if (!handle) {
        handle = this.createPaneDividerHandle(model, index);
        this.paneDividerHandles[index] = handle;
        this.container.appendChild(handle.root);
      } else {
        handle.update(model);
      }
    }
  }

  private startPaneResize(dividerIndex: number, event: PointerEvent) {
    const beforePane = this.panes[dividerIndex];
    const afterPane = this.panes[dividerIndex + 1];
    if (!beforePane || !afterPane) return;

    this.stopPaneResize();
    this.paneHeightsCustomized = true;
    this.paneResizeDrag = {
      dividerIndex,
      startClientY: event.clientY,
      beforeStartHeight:
        this.paneHeights.get(beforePane) ?? beforePane.getRegion().height,
      afterStartHeight:
        this.paneHeights.get(afterPane) ?? afterPane.getRegion().height,
      disposers: [
        bindEvent(window, "pointermove", this.onPaneResizeMove),
        bindEvent(window, "pointerup", this.onPaneResizeEnd),
        bindEvent(window, "pointercancel", this.onPaneResizeEnd)
      ]
    };
  }

  private onPaneResizeMove = (event: PointerEvent) => {
    if (!this.paneResizeDrag) return;
    event.preventDefault();

    const drag = this.paneResizeDrag;
    const beforePane = this.panes[drag.dividerIndex];
    const afterPane = this.panes[drag.dividerIndex + 1];
    if (!beforePane || !afterPane) return;

    const dy = event.clientY - drag.startClientY;
    const beforeMin = this.getPaneMinHeight(beforePane);
    const afterMin = this.getPaneMinHeight(afterPane);
    const clampedDy = Math.max(
      beforeMin - drag.beforeStartHeight,
      Math.min(dy, drag.afterStartHeight - afterMin)
    );

    const desired = new Map(this.paneHeights);
    desired.set(beforePane, drag.beforeStartHeight + clampedDy);
    desired.set(afterPane, drag.afterStartHeight - clampedDy);
    this.normalizePaneHeights(desired);
    this.applyPaneLayout({ redraw: true, immediate: true });
  };

  private onPaneResizeEnd = (event: PointerEvent) => {
    event.preventDefault();
    this.stopPaneResize();
  };

  private stopPaneResize() {
    if (!this.paneResizeDrag) return;
    for (const dispose of this.paneResizeDrag.disposers.splice(0)) dispose();
    this.paneResizeDrag = undefined;
  }

  private getPaneInitParams(pane: Pane): InitParams {
    const region = pane.getRegion();
    const yAxisRegion = pane.getYAxisRegion();

    return {
      width: region.width + yAxisRegion.width,
      height: region.height,
      y: region.y,
      x: region.x,
      devicePixelRatio: pixelRatio(),
      pane
    };
  }

  private getPaneAtY(y: number) {
    return this.panes.find((pane) => pane.containsY(y));
  }

  private getPaneById(id?: number) {
    if (id === undefined) return this.mainPane;
    return this.panes.find((pane) => pane.getId() === id) ?? this.mainPane;
  }

  private clearCrosshairState() {
    this.pointerTime = -1;
    this.crosshairDataPoint = null;
    this.pointerY = -1;
    this.pointerPane = this.mainPane;
    this.isProgrammaticCrosshair = false;
  }

  private refreshIndicatorLabels(dataTime?: number) {
    for (const indicator of this.paneledIndicators) {
      indicator.refreshLabel(dataTime);
    }
    for (const indicator of this.indicators) {
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
    const index = this.dataStore.nearestIndex(options.time);
    if (index === -1) return undefined;

    const dataPoint = this.dataStore.get(index);
    if (!dataPoint) return undefined;

    const x = this.getTimeScale().project(dataPoint.time, {
      canvas: this.getContext("main").canvas,
      barAlignment: this.getTimeAnchorAlignment()
    });
    if (x < 0 || x > this.getDrawingSize().width) return undefined;

    const pane = this.getPaneById(options.paneId);
    const y = this.resolveCrosshairY(options, pane, dataPoint);

    return {
      time: dataPoint.time,
      y,
      pane,
      dataPoint
    };
  }

  private configureRenderPipeline() {
    this.renderPipeline.addHook("beforeDraw", () => this.beforeDrawPlugins());
    this.renderPipeline.addHook("grid", () => this.prepareControllerDraw());
    this.renderPipeline.addHook("axes", () => this.drawControllerAxes());
    this.renderPipeline.addHook("series", () => this.drawControllerSeries());
    this.renderPipeline.addHook("indicators", () => this.drawIndicators());
    this.renderPipeline.addHook("drawings", () => this.drawPlugins());
    this.renderPipeline.addHook("annotations", () =>
      this.drawPriceAxisAnnotations()
    );
    this.renderPipeline.addHook("crosshair", () => this.drawCrosshair());
    this.renderPipeline.addHook("afterDraw", () => this.afterDrawPlugins());
  }

  public onRenderStage(
    stage: RenderStage,
    callback: RenderCallback
  ): () => void {
    return this.renderPipeline.addHook(stage, callback);
  }

  private redraw(layers: Iterable<RenderLayer>) {
    this.renderPipeline.render(layers);
  }

  public changeType(type: ControllerType) {
    this.updateOptions({ type });
  }

  private findClosestDataPoint(rawPoint: ChartData): ChartData | undefined {
    const time = this.controller.getTimeFromRawDataPoint(rawPoint);
    const closestIndex = this.dataStore.nearestIndex(time);
    return closestIndex === -1 ? undefined : this.dataStore.get(closestIndex);
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
    this.configureRenderPipeline();
    this.applyPaneLayout({ resizeCanvases: false, resizeIndicators: false });
    // Init and scale canveses
    this.types.forEach((type) => this.getOwnedCanvas(type));
    const topCanvas = this.getCanvas("crosshair");
    this.eventDisposers.push(
      bindEvent(topCanvas, "pointerdown", this.onMouseDown),
      bindEvent(topCanvas, "pointerup", this.onMouseUp),
      bindEvent(topCanvas, "mousemove", this.onMouseMove),
      bindEvent(topCanvas, "wheel", this.onWheel, { passive: false }),
      bindEvent(topCanvas, "touchstart", this.onTouchStart, { passive: false }),
      bindEvent(topCanvas, "touchend", this.onTouchEnd, { passive: false }),
      bindEvent(topCanvas, "touchmove", this.onTouchMove, { passive: false }),
      bindEvent(topCanvas, "contextmenu", (e) => {
        e.preventDefault();
      }),
      bindEvent(topCanvas, "pointerleave", (e) => {
        if (e.pointerType === "touch") return;
        this.lastPointerPosition = undefined;
        this.lastTouchDistance = undefined;
        this.isPanning = false;
        requestAnimationFrame(() => this.clearCrosshair());
      })
    );

    const createResizers = (): Resizer => {
      let alreadyResized = false;
      let oldRatio = pixelRatio();

      const resizer = (force: boolean) => {
        if (alreadyResized && !force) {
          alreadyResized = false;
          return;
        }
        this.applyPaneLayout();

        this.indicatorLabelContainer.style.maxHeight =
          this.getLogicalCanvas("main").height -
          this.options.theme.crosshair.infoLine.fontSize -
          30 +
          "px";

        if (this.dataStore.length > 0) {
          // requestAnimationFrame(() => {
          const preserveRightEdge = this.isPinnedToRightEdge();
          const span = this.getVisibleIndexSpan();
          if (this.autoTimeRange) {
            this.updateAutoTimeRange(true);
          }

          const rangeChanged = this.refreshIndexBounds({
            reset: span === this.getIndexBoundsSpan(),
            preserveRightEdge,
            span
          });
          if (rangeChanged) {
            this.recalculateVisibleScale();
            this.notifyExtensionsVisibleRangeChanged();
          }

          this.requestRedraw(this.allRedrawParts, true);
        }
      };

      return {
        resize: resizer,
        ratioResize: () => {
          const newRatio = pixelRatio();
          if (oldRatio === newRatio) return;
          oldRatio = newRatio;
          resizer(true);
          alreadyResized = true;
        }
      };
    };

    this.resizer = createResizers();

    this.eventDisposers.push(
      bindEvent(window, "resize", this.resizer.ratioResize)
    );

    this.resizeObserver = new ResizeObserver(() => this.resizer.resize(false));
    this.resizeObserver.observe(this.container);
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
    const firstPoint = this.dataStore.get(0)!;
    const lastPoint = this.dataStore.get(this.dataStore.length - 1)!;
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
        this.dataStore.snapshot(),
        this.timeRange,
        this.getTimeScaleOptions()
      );
    }
  }

  private createOptionsState(): ChartOptionsState {
    return Object.freeze({
      type: this.options.type,
      timeRange:
        this.options.timeRange === "auto"
          ? "auto"
          : Object.freeze({ ...this.options.timeRange }),
      stepSize: this.options.stepSize,
      maxZoom: this.options.maxZoom,
      volume: this.options.volume,
      theme: cloneAndFreeze(this.options.theme),
      locale: this.options.locale,
      timeZone: this.options.timeZone,
      formatter: this.options.formatter,
      localeValues: cloneAndFreeze(this.options.localeValues)
    });
  }

  private resetViewInteractionState() {
    this.visibleIndexRange = { from: 0, to: 1 };
    this.indexBounds = { from: 0, to: 1 };
    this.isPanning = false;
    this.clearCrosshairState();
    this.lastTouchDistance = undefined;
    this.lastPointerPosition = undefined;
    this.isTouchCrosshair = false;
    this.isTouchCrosshairTimeout = undefined;
  }

  private applyConfiguredTimeRange() {
    const configuredTimeRange = this.options.timeRange;
    this.autoTimeRange = configuredTimeRange === "auto";
    if (configuredTimeRange === "auto") {
      if (this.dataStore.length > 0) {
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
      this.dataStore.snapshot(),
      this.timeRange
    );
    this.visibleScale = this.controller.createDataScale([], {
      start: 0,
      end: 0
    });
    if (resetVisibleRange) this.resetVisibleIndexRange();
    this.syncTimeScales();
    if (this.dataStore.length > 0) this.recalculateVisibleScale();
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
    this.updatePaneDividers();
  }

  private refreshLocalizationLabels() {
    for (const indicator of this.indicators) {
      indicator.refreshLabel();
    }
    for (const indicator of this.paneledIndicators) {
      indicator.refreshLabel();
    }
  }

  /** Applies an options patch in one reset, remap, and redraw cycle. */
  public updateOptions(update: ChartOptionsUpdate): void {
    this.applyOptionsUpdate(update);
  }

  private applyOptionsUpdate(
    update: ChartOptionsUpdate,
    behavior: OptionsUpdateBehavior = {}
  ): ChartOptionsChangeEvent | undefined {
    const emit = behavior.emit ?? true;
    const notifyExtensions = behavior.notifyExtensions ?? emit;
    const redraw = behavior.redraw ?? true;
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
      ? mergeThemes(this.options.theme, update.theme)
      : this.options.theme;
    const localeValues = has("localeValues")
      ? {
          ...this.getDefaultLocaleValues(),
          ...this.options.localeValues,
          ...(update.localeValues ?? {})
        }
      : this.options.localeValues;

    assertTimeRange(timeRange);
    assertPositiveOption("stepSize", stepSize);
    assertPositiveOption("maxZoom", maxZoom);
    if (type !== this.options.type) this.getControllerClass(type);

    const changes: Array<[ChartOptionKey, boolean]> = [
      ["type", type !== this.options.type],
      ["timeRange", !timeRangesEqual(timeRange, this.options.timeRange)],
      ["stepSize", stepSize !== this.options.stepSize],
      ["maxZoom", maxZoom !== this.options.maxZoom],
      ["volume", volume !== this.options.volume],
      ["theme", !deepEqual(theme, this.options.theme)],
      ["locale", locale !== this.options.locale],
      ["timeZone", timeZone !== this.options.timeZone],
      ["formatter", formatter !== this.options.formatter],
      ["localeValues", !deepEqual(localeValues, this.options.localeValues)]
    ];
    const changedKeys = changes
      .filter(([, changed]) => changed)
      .map(([key]) => key);
    if (changedKeys.length === 0) return;

    const previous = this.createOptionsState();
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
      timeRange === "auto" ? "auto" : { ...timeRange };
    this.options.stepSize = stepSize;
    this.options.maxZoom = maxZoom;
    this.options.volume = volume;
    this.options.theme = theme;
    this.options.locale = locale;
    this.options.timeZone = timeZone;
    this.options.formatter = formatter;
    this.options.localeValues = localeValues;

    if (typeChanged) {
      const ControllerClass = this.getControllerClass(type);
      this.controller = new ControllerClass(this, this.options);
    }

    if (coreChanged) {
      this.resetViewInteractionState();
      if (stepSizeChanged) {
        this.dataStore = new DataStore(
          this.mapDataToStepSize(
            this.originalDataStore.snapshot(),
            this.options.stepSize
          )
        );
      }
      this.applyConfiguredTimeRange();
      this.rebuildScales(true);
      if (notifyExtensions && this.dataStore.length > 0) {
        this.notifyExtensionsVisibleRangeChanged();
        if (stepSizeChanged) {
          this.notifyExtensionsData(this.dataStore.snapshot());
        }
      }
    } else if (typeChanged) {
      this.rebuildScales(false);
      if (notifyExtensions && this.dataStore.length > 0) {
        this.notifyExtensionsVisibleRangeChanged();
      }
    }

    if (changed.has("theme")) this.applyThemeChrome(previousThemeKey);
    if (localizationChanged) this.refreshLocalizationLabels();

    const redrawParts = new Set<RenderLayer>();
    const includeRedrawParts = (parts: readonly RenderLayer[]) => {
      for (const part of parts) redrawParts.add(part);
    };
    if (this.dataStore.length > 0) {
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
      this.priceAxisAnnotations.size > 0 &&
      (changed.has("theme") || localizationChanged)
    ) {
      redrawParts.add("annotations");
    }

    this.refreshOptionsSnapshot();
    if (redraw && redrawParts.size > 0) {
      this.requestRedraw([...redrawParts]);
    }
    const event = {
      previous,
      current: this.createOptionsState(),
      changedKeys: Object.freeze(changedKeys)
    } satisfies ChartOptionsChangeEvent;
    if (emit) {
      this.emit("options-change", event);
    } else if (notifyExtensions) {
      this.notifyExtensionsOptionsChanged(event);
    }
    return event;
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

  private onMouseDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (event.button !== 0) return;
    const rect = this.getContext("crosshair").canvas.getBoundingClientRect();
    const pointerEvent = this.createPluginPointerEvent(
      "down",
      event.clientX - rect.left,
      event.clientY - rect.top,
      event
    );
    this.pointerGestureConsumed = pointerEvent
      ? this.notifyExtensionsPointer(pointerEvent)
      : false;
    this.lastPointerPosition = this.pointerGestureConsumed
      ? undefined
      : { x: event.clientX };
  };

  private onMouseUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;
    const topCanvas = this.getContext("crosshair").canvas;
    const rect = topCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pointerEvent = this.createPluginPointerEvent("up", x, y, e);
    const consumed = pointerEvent
      ? this.notifyExtensionsPointer(pointerEvent)
      : false;

    if (!this.isPanning && !this.pointerGestureConsumed && !consumed) {
      const rawPoint = this.dataScale.pixelToPoint(
        x,
        y,
        this.getContext("main").canvas
      );
      const closestDataPoint = this.findClosestDataPoint(rawPoint);
      if (closestDataPoint) {
        this.emit("click", { event: e, point: closestDataPoint });
      }
    }
    this.lastPointerPosition = undefined;
    this.pointerGestureConsumed = false;
    this.isPanning = false;
  };

  /**
   * Get the number of pixels per millisecond-sized bar slot.
   *
   * @returns pixels per millisecond-sized bar slot
   */
  private onMouseMove = (event: MouseEvent) => {
    if (this.dataStore.length == 0) return;
    if (this.lastPointerPosition) {
      this.isPanning = true;
      const dx = event.clientX - this.lastPointerPosition.x;
      this.panVisibleIndexRange(dx);
      this.lastPointerPosition = { x: event.clientX };
    } else {
      this.isPanning = false;
    }
    // requestAnimationFrame(() => {
    const rect = this.getContext("crosshair").canvas.getBoundingClientRect();
    this.pointerMove({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    // });
  };

  private adjustZoomLevel(zoomFactor: number, anchorPixel?: number) {
    this.zoomVisibleIndexRangeAtPixel(
      anchorPixel ?? this.getDrawingSize().width / 2,
      zoomFactor
    );
  }

  private onWheel = (event: WheelEvent) => {
    if (this.dataStore.length == 0) return;
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9; // adjust these values as needed

    const offsetX = event.clientX - this.container.getBoundingClientRect().left;

    this.adjustZoomLevel(zoomFactor, offsetX);
  };

  private prepareControllerDraw() {
    const ctx = this.getContext("main");
    const sizes = this.getLogicalCanvas("main");
    ctx.clearRect(0, 0, sizes.width, sizes.height);
    ctx.fillStyle = this.options.theme.backgroundColor;
    ctx.fillRect(0, 0, sizes.width, sizes.height);

    if (this.dataStore.length === 0) return;
    this.recalculateVisibleScale();
    this.drawControllerGrid();
  }

  private drawControllerGrid() {
    const mainCtx = this.getContext("main");
    const mainSize = this.getLogicalCanvas("main");
    const yAxisSize = this.getLogicalCanvas("y-label");
    const yAxisValues = this.calculateYAxisLabels(30);

    mainCtx.lineWidth = this.options.theme.grid.width;
    mainCtx.strokeStyle = this.options.theme.grid.color;

    for (const value of yAxisValues) {
      const y = value.position;
      if (y - this.options.theme.yAxis.fontSize < 0) continue;
      if (y + this.options.theme.yAxis.fontSize > yAxisSize.height) continue;

      mainCtx.beginPath();
      mainCtx.moveTo(0, y);
      mainCtx.lineTo(mainSize.width, y);
      mainCtx.stroke();
    }

    const xAxisCtx = this.getContext("x-label");
    xAxisCtx.font = `${this.options.theme.xAxis.fontSize}px ${this.options.theme.xAxis.font}, monospace`;
    const xGridCoords: number[] = [];

    for (const label of this.getXAxisLabels(xAxisCtx)) {
      mainCtx.beginPath();
      mainCtx.moveTo(label.x, 0);
      mainCtx.lineTo(label.x, mainSize.height);
      mainCtx.stroke();
      xGridCoords.push(label.x);
    }
    this.lastXGridCoords = freezeSnapshot(xGridCoords);
  }

  private drawControllerAxes() {
    if (this.dataStore.length === 0) {
      for (const layer of ["x-label", "y-label"] as const) {
        const ctx = this.getContext(layer);
        const size = this.getLogicalCanvas(layer);
        ctx.clearRect(0, 0, size.width, size.height);
      }
      return;
    }
    this.drawYAxis();
    this.drawXAxis();
  }

  private drawControllerSeries() {
    if (this.dataStore.length === 0) return;
    if (this.options.volume) {
      this.drawVolumeBars();
    }
    this.controller.draw();
  }

  protected onZoom() {
    this.redraw(["crosshair"]);
  }

  private onTouchStart = (event: TouchEvent) => {
    if (this.dataStore.length == 0) return;

    if (event.touches.length === 1) {
      this.lastPointerPosition = {
        x: event.touches[0].clientX
      };
      this.isTouchCrosshairTimeout = setTimeout(() => {
        this.isTouchCrosshair = !this.isTouchCrosshair;
        this.isTouchCrosshairTimeout = undefined;
        if (this.isTouchCrosshair) {
          const rect =
            this.getContext("crosshair").canvas.getBoundingClientRect();
          this.pointerMove({
            x: event.touches[0].clientX - rect.left,
            y: event.touches[0].clientY - rect.top
          });
        } else {
          this.lastPointerPosition = undefined;
          this.lastTouchDistance = undefined;
          this.clearCrosshair();
        }
      }, 500);
    } else if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (!this.isTouchCrosshair) {
      this.lastPointerPosition = undefined;
      this.lastTouchDistance = undefined;
    }
    if (this.isTouchCrosshairTimeout != undefined) {
      if (this.isTouchCrosshair && e.changedTouches.length === 1) {
        const rect =
          this.getContext("crosshair").canvas.getBoundingClientRect();
        const point = this.findClosestDataPoint(
          this.visibleScale.pixelToPoint(
            e.changedTouches[0].clientX - rect.left,
            e.changedTouches[0].clientY - rect.top,
            this.getContext("main").canvas
          )
        );
        if (!point) return;
        this.emit("touch-click", { event: e, point });
      }
      clearTimeout(this.isTouchCrosshairTimeout);
      this.isTouchCrosshairTimeout = undefined;
    }
  };

  private onTouchMove = (event: TouchEvent) => {
    if (this.dataStore.length == 0) return;
    if (this.isTouchCrosshairTimeout) {
      clearTimeout(this.isTouchCrosshairTimeout);
      this.isTouchCrosshairTimeout = undefined;
    }
    if (event.touches.length === 1 && this.lastPointerPosition) {
      if (this.isTouchCrosshair) {
        requestAnimationFrame(() => {
          const rect =
            this.getContext("crosshair").canvas.getBoundingClientRect();

          this.pointerMove({
            x: event.touches[0].clientX - rect.left,
            y: event.touches[0].clientY - rect.top
          });
        });
        return;
      }
      const dx = event.touches[0].clientX - this.lastPointerPosition.x;
      this.panVisibleIndexRange(dx);
      this.lastPointerPosition = {
        x: event.touches[0].clientX
      };
    } else if (event.touches.length === 2 && this.lastTouchDistance) {
      if (this.isTouchCrosshair) return;
      event.preventDefault();
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const zoomFactor = distance / this.lastTouchDistance; // calculate zoom factor based on change in distance
      const rect = this.getContext("crosshair").canvas.getBoundingClientRect();
      const offsetX =
        (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      this.adjustZoomLevel(zoomFactor, offsetX);
      this.lastTouchDistance = distance;
    } else {
      const rect = this.getContext("crosshair").canvas.getBoundingClientRect();
      this.pointerMove({
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top
      });
    }
  };

  private adjustCanvas(
    type: ChartOwnedCanvasLayer,
    canvas: HTMLCanvasElement
  ) {
    const devicePixelRatio = pixelRatio();
    let width: number;
    let height: number;
    let right: number | undefined;
    let bottom: number | undefined;

    if (type === "y-label") {
      const yAxisRegion = this.mainPane.getYAxisRegion();
      right = 0;
      width = yAxisRegion.width;
      height = yAxisRegion.height;
    } else if (type === "annotations" || type === "drawings") {
      width =
        type === "annotations"
          ? this.container.offsetWidth
          : this.mainPane.getRegion().width;
      height = this.getPaneLayoutHeight();
    } else if (type === "x-label" || type === "crosshair") {
      width = this.container.offsetWidth;
      height =
        type === "x-label" ? this.xLabelHeight : this.container.offsetHeight;
      if (type === "x-label") {
        bottom = 0;
      }
    } else {
      const region = this.mainPane.getRegion();
      width = region.width;
      height = region.height;
    }

    resizeCanvasLayer(canvas, {
      right,
      bottom,
      width,
      height,
      pixelRatio: devicePixelRatio,
      context: this.contexts.get(type)
    });
  }

  protected getCanvas(type: ChartCanvasLayer): HTMLCanvasElement {
    return this.getOwnedCanvas(type);
  }

  private getOwnedCanvas(type: ChartOwnedCanvasLayer): HTMLCanvasElement {
    const canvas: HTMLCanvasElement =
      this.canvases.get(type) || createCanvasLayer();

    if (!this.canvases.has(type)) {
      canvas.style.zIndex =
        type === "crosshair"
          ? "100"
          : type === "drawings"
            ? "60"
            : type === "annotations"
              ? "70"
              : type === "indicator"
                ? "50"
                : "1";
      this.container.appendChild(canvas);
      this.canvases.set(type, canvas);
    }

    this.adjustCanvas(type, canvas);

    if (type === "crosshair") {
      canvas.style.touchAction = "pan-x";
    }

    return canvas;
  }

  protected font(): string {
    return `12px monospace`;
  }

  private resizeCanvases() {
    const types = this.types;
    types.forEach((type) => {
      const canvas = this.canvases.get(type);
      if (!canvas) return;

      this.adjustCanvas(type, canvas);
    });
  }

  /**
   * Convert logical pixels to physical pixels
   *
   * @param num number to convert
   * @returns number in device pixels
   */
  protected p(num: number) {
    return num * pixelRatio();
  }

  /**
   * Convert physical pixels to logical pixels
   *
   * @param num number to convert
   * @returns number in logical pixels
   */
  protected l(num: number) {
    return num / pixelRatio();
  }

  getContext(type: ChartCanvasLayer): CanvasRenderingContext2D {
    return this.getOwnedContext(type);
  }

  private getOwnedContext(
    type: ChartOwnedCanvasLayer
  ): CanvasRenderingContext2D {
    if (!this.contexts.has(type)) {
      const ctx = this.getOwnedCanvas(type).getContext("2d")!;
      scaleCanvasContext(ctx);
      this.contexts.set(type, ctx);
    }

    return this.contexts.get(type)!;
  }

  /**
   * Get the logical canvas size.
   *
   * @param type which canvas you want1
   * @returns    the logical canvas size
   */
  getLogicalCanvas(type: ChartCanvasLayer) {
    return this.getOwnedLogicalCanvas(type);
  }

  private getOwnedLogicalCanvas(type: ChartOwnedCanvasLayer) {
    const ratio = pixelRatio();
    const width = this.getOwnedContext(type).canvas.width / ratio;
    const height = this.getOwnedContext(type).canvas.height / ratio;
    return { width, height };
  }

  /**
   * Gets the true drawing size.
   *
   * @returns the logical size of the main canvas
   */
  getDrawingSize() {
    return this.getLogicalCanvas("main");
  }

  /**
   * Gets the full drawing size including axis label areas.
   *
   * @returns the logical size of the full drawing area
   */
  getFullSize() {
    return this.getLogicalCanvas("crosshair");
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
    if (this.dataStore.length === 0) return this.timeRange;

    const startIndex = Math.max(
      0,
      Math.min(
        Math.floor(this.visibleIndexRange.from),
        this.dataStore.length - 1
      )
    );
    const endIndex = Math.max(
      startIndex,
      Math.min(
        Math.ceil(this.visibleIndexRange.to) - 1,
        this.dataStore.length - 1
      )
    );
    const startPoint = this.dataStore.get(startIndex)!;
    const endPoint = this.dataStore.get(endIndex)!;

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
    if (this.dataStore.length === 0) return this.timeRange;

    const alignmentOffset = this.getBarAlignmentOffset();

    return {
      start: this.dataStore.timeAtLogicalIndex(
        this.visibleIndexRange.from - alignmentOffset,
        this.options.stepSize
      ),
      end: this.dataStore.timeAtLogicalIndex(
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
    this.originalDataStore = new DataStore(data);
    this.dataStore = new DataStore(
      this.mapDataToStepSize(
        this.originalDataStore.snapshot(),
        this.options.stepSize
      )
    );

    if (this.dataStore.length === 0) {
      this.resetEmptyDataState();
      this.notifyExtensionsData(this.dataStore.snapshot());
      this.requestRedraw(this.allRedrawParts, true);
      return;
    }

    if (this.autoTimeRange) {
      this.updateAutoTimeRange(false);
    }

    this.dataScale = this.controller.createDataScale(
      this.dataStore.snapshot(),
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
    this.clearCrosshair();
    if (rangeChanged) this.notifyExtensionsVisibleRangeChanged();
    this.notifyExtensionsData(this.dataStore.snapshot());

    this.requestRedraw(this.allRedrawParts);
  }

  /**
   * Appends or merges one streaming point.
   *
   * @throws {TypeError} when a present data value is not finite
   * @throws {RangeError} when the timestamp is older than the latest point
   */
  public updateData(data: ChartData): void {
    if (this.dataStore.length === 0) {
      this.setData([data]);
      return;
    }

    const preserveRightEdge = this.isPinnedToRightEdge();
    const span = this.getVisibleIndexSpan();
    const latestTime = this.originalDataStore.get(
      this.originalDataStore.length - 1
    )!.time;

    if (data.time < latestTime) {
      throw new RangeError(
        "updateData() requires a timestamp at or after the latest point. Use setData() to apply older corrections."
      );
    }

    const originalIndex = this.originalDataStore.append(data);
    this.transformNewData(this.originalDataStore.get(originalIndex)!);

    if (this.autoTimeRange) {
      this.updateAutoTimeRange(true);
    }

    const rangeChanged = this.refreshIndexBounds({ preserveRightEdge, span });
    if (rangeChanged) {
      this.recalculateVisibleScale();
      this.notifyExtensionsVisibleRangeChanged();
    }
    this.notifyExtensionsData(this.dataStore.snapshot());
    this.requestRedraw(this.allRedrawParts);
  }

  public clearData(): void {
    this.setData([]);
  }

  private resetEmptyDataState(): void {
    if (this.autoTimeRange) {
      this.timeRange = { start: 0, end: 0 };
    }

    this.indexBounds = { from: 0, to: 1, rightOffset: 0 };
    this.visibleIndexRange = { ...this.indexBounds };
    this.lastVisibleDataPoints = Object.freeze([]);
    this.lastXGridCoords = Object.freeze([]);
    this.dataScale = this.controller.createDataScale([], this.timeRange);
    this.visibleScale.clearModifiers();
    this.visibleScale.recalculate(
      [],
      this.timeRange,
      this.getTimeScaleOptions()
    );
    this.syncTimeScales();
    this.syncMainPanePriceScale();
    this.clearCrosshair();
  }

  private recalcPaneledIndicators() {
    this.applyPaneLayout();
  }

  /** @internal Called by an attached indicator's protected invalidation helper. */
  public invalidateIndicator(
    indicator: Indicator<any, any>,
    options: IndicatorInvalidationOptions = {}
  ): void {
    if (!this.isExtensionAttached(indicator)) return;

    const redrawParts = new Set<RenderLayer>();
    if (options.scale && this.dataStore.length > 0) {
      this.recalculateVisibleScale();
      for (const layer of this.controllerRedrawParts) {
        redrawParts.add(layer);
      }
      redrawParts.add("indicators");
      redrawParts.add("annotations");
      redrawParts.add("crosshair");
    }
    if (options.label ?? true) {
      indicator.refreshLabel(
        this.pointerTime === -1 ? undefined : this.pointerTime
      );
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
    if (
      this.indicators.includes(indicator) ||
      this.paneledIndicators.some((item) => item === indicator)
    ) {
      throw new Error("Indicator instance is already attached to this chart.");
    }
    if (this.getIndicatorById(indicator.getInstanceId())) {
      throw new Error(
        `Indicator instanceId "${indicator.getInstanceId()}" is already attached to this chart.`
      );
    }

    try {
      indicator.attach(this.createChartContext(indicator));
    } catch (error) {
      this.disposeExtensionScope(indicator);
      indicator.releaseAttachment();
      throw error;
    }

    if (this.isPaneledIndicator(indicator)) {
      // Main chart must have at least 25% of the height
      // every indicator by default gets 25% of the height
      // if it is possible. Otherwise they equally get less.

      this.paneledIndicators.push(indicator);
      const pane = this.createPaneForIndicator(indicator);
      this.applyPaneLayout({
        resizeCanvases: false,
        resizeIndicators: false
      });
      indicator.init(this.getPaneInitParams(pane));

      this.container.appendChild(indicator.getContainer());

      this.recalcPaneledIndicators();

      this.requestRedraw(this.allRedrawParts);
      indicator.refreshLabel();
    } else {
      this.indicators.push(indicator);
      this.requestRedraw(this.allRedrawParts);
      this.indicatorLabelContainer.appendChild(indicator.getLabelContainer());
      indicator.refreshLabel();
    }

    try {
      this.deliverInitialExtensionState(indicator);
    } catch (error) {
      this.removeIndicator(indicator, { emit: false });
      throw error;
    }

    if (!this.isExtensionAttached(indicator)) {
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
    if (this.isPaneledIndicator(indicator)) {
      const index = this.paneledIndicators.indexOf(indicator);
      if (index === -1) return false;

      this.paneledIndicators.splice(index, 1);
      this.disposeExtensionScope(indicator);
      try {
        indicator.detach();
      } finally {
        indicator.releaseAttachment();
        if (indicator.getContainer().parentElement === this.container) {
          this.container.removeChild(indicator.getContainer());
        }
        this.removePaneForIndicator(indicator);
        this.recalcPaneledIndicators();
        this.requestRedraw(this.allRedrawParts);
      }
    } else {
      const index = this.indicators.indexOf(indicator);
      if (index === -1) return false;

      this.indicators.splice(index, 1);
      this.disposeExtensionScope(indicator);
      try {
        indicator.detach();
      } finally {
        indicator.releaseAttachment();
        this.visibleScale.removeModifier(indicator);
        if (
          indicator.getLabelContainer().parentElement ===
          this.indicatorLabelContainer
        ) {
          this.indicatorLabelContainer.removeChild(
            indicator.getLabelContainer()
          );
        }
        this.requestRedraw(this.allRedrawParts);
      }
    }

    if (options.emit ?? true) {
      this.emit("indicator-remove", { indicator });
    }
    return true;
  }

  public getCrosshairState(): ChartCrosshairState | undefined {
    if (
      this.pointerTime === -1 ||
      this.pointerY === -1 ||
      !this.crosshairDataPoint
    ) {
      return undefined;
    }

    return {
      time: this.pointerTime,
      y: this.pointerY,
      pane: this.pointerPane,
      dataPoint: this.crosshairDataPoint
    };
  }

  public setCrosshair(
    options: ChartCrosshairOptions
  ): ChartCrosshairState | undefined {
    const state = this.resolveCrosshairState(options);
    if (!state) {
      this.clearCrosshair();
      return undefined;
    }

    this.crosshairDataPoint = state.dataPoint;
    this.pointerTime = state.time;
    this.pointerY = state.y;
    this.pointerPane = state.pane;
    this.isProgrammaticCrosshair = true;
    this.requestRedraw("crosshair");
    this.emit("crosshair-change", state);

    return state;
  }

  public clearCrosshair(): void {
    const hadCrosshair = this.getCrosshairState() !== undefined;
    this.clearCrosshairState();
    this.refreshIndicatorLabels();
    this.requestRedraw("crosshair");
    if (hadCrosshair) {
      this.emit("crosshair-clear", {});
    }
  }

  protected pointerMove(e: { x: number; y: number }) {
    if (this.isTouchCapable && !this.isTouchCrosshair) return;
    const rawPoint = this.visibleScale.pixelToPoint(
      e.x,
      e.y,
      this.getContext("main").canvas
    );
    const closestDataPoint = this.findClosestDataPoint(rawPoint);
    if (!closestDataPoint) return;
    this.crosshairDataPoint = closestDataPoint;
    this.pointerTime = closestDataPoint.time;
    this.pointerY = Math.min(
      e.y,
      this.container.offsetHeight - this.xLabelHeight
    );
    this.pointerPane = this.getPaneAtY(this.pointerY) ?? this.mainPane;
    this.isProgrammaticCrosshair = false;
    this.notifyExtensionsPointer({
      type: "move",
      x: e.x,
      y: this.pointerY,
      time: this.pointerTime,
      pane: this.pointerPane,
      dataPoint: closestDataPoint
    });

    this.requestRedraw("crosshair");
    const state = this.getCrosshairState();
    if (state) {
      this.emit("crosshair-change", state);
    }
  }

  private drawVolumeBars() {
    const ctx = this.getContext("main");
    const spacing = 0.1;
    const pixelsPerBar = this.getPixelsPerBar();
    const visibleDataPoints = this.recalculateVisibleScale();
    const candleSpacing = pixelsPerBar * spacing;
    const candleWidth = pixelsPerBar - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

    const timeRange = this.getTimeRange();
    const timeScale = this.getTimeScale();
    const volumeScale = this.getVolumeScale();
    const scaleOptions = {
      canvas: ctx.canvas,
      barAlignment: "edge" as const
    };

    for (let i = 0; i < visibleDataPoints.length; i++) {
      const point = visibleDataPoints[i];
      if (point.time < timeRange.start) continue;
      if (point.time > timeRange.end) break;

      const x = timeScale.project(point.time, scaleOptions);
      const y = volumeScale.projectVolume(point.volume!, scaleOptions);

      const volumeBarStartY = this.getDrawingSize().height - y;

      ctx.beginPath();
      ctx.fillStyle =
        point.close! > point.open!
          ? this.options.theme.volume.upColor
          : this.options.theme.volume.downColor;
      ctx.rect(
        x + candleSpacing / 2,
        volumeBarStartY, // This ensures bars grow upwards from the bottom
        candleWidth,
        y // Height of the bar
      );
      ctx.fill();
    }
  }

  private drawIndicators() {
    const ctx = this.getContext("indicator");
    const sizes = this.getLogicalCanvas("indicator");

    ctx.clearRect(0, 0, sizes.width, sizes.height);

    if (this.dataStore.length === 0) {
      for (const indicator of this.paneledIndicators) {
        indicator.clearDrawing();
      }
      return;
    }

    for (const indicator of this.indicators) {
      indicator.draw();
    }
    for (const indicator of this.paneledIndicators) {
      indicator.draw();
    }
  }

  private drawPriceAxisAnnotations() {
    const context = this.getOwnedContext("annotations");
    const size = this.getOwnedLogicalCanvas("annotations");
    renderPriceAxisAnnotations({
      context,
      width: size.width,
      height: size.height,
      panes: this.panes,
      annotations: this.getPriceAxisAnnotations(),
      theme: this.options.theme,
      formatter: this.options.formatter
    });
  }

  private *getPriceAxisAnnotations(): IterableIterator<PriceAxisAnnotation> {
    for (const indicator of this.indicators) {
      const annotations = this.priceAxisAnnotations.get(indicator);
      if (annotations) yield* annotations;
    }
    for (const indicator of this.paneledIndicators) {
      const annotations = this.priceAxisAnnotations.get(indicator);
      if (annotations) yield* annotations;
    }
    for (const plugin of this.plugins) {
      const annotations = this.priceAxisAnnotations.get(plugin);
      if (annotations) yield* annotations;
    }
  }

  private drawCrosshair(): void {
    const ctx = this.getContext("crosshair");
    const sizes = this.getLogicalCanvas("crosshair");
    ctx.clearRect(0, 0, sizes.width, sizes.height);

    if (this.pointerTime === -1) return;
    if (this.pointerY === -1) return;
    if (
      this.isTouchCapable &&
      !this.isTouchCrosshair &&
      !this.isProgrammaticCrosshair
    ) {
      return;
    }

    if (this.pointerY >= this.container.offsetHeight - this.xLabelHeight) {
      this.getContext("crosshair").clearRect(0, 0, sizes.width, sizes.height);
      return;
    }

    const x = this.getTimeScale().project(this.pointerTime, {
      canvas: this.getContext("main").canvas,
      barAlignment: this.getTimeAnchorAlignment()
    });
    ctx.strokeStyle = this.options.theme.crosshair.color;
    ctx.lineWidth = this.options.theme.crosshair.width;
    ctx.setLineDash(this.options.theme.crosshair.lineDash);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, this.container.offsetHeight - this.xLabelHeight);
    ctx.moveTo(0, this.pointerY);
    ctx.lineTo(this.getDrawingSize().width, this.pointerY);
    ctx.stroke();
    const text = this.options.formatter.formatTooltipDate(this.pointerTime);
    const textWidth = ctx.measureText(text).width;
    const textPadding = 10;
    const rectWidth = textWidth + textPadding * 2;
    const maxRectX = this.getFullSize().width - rectWidth;
    const rectX = Math.min(
      Math.max(x - textWidth / 2 - textPadding, 0),
      maxRectX
    );
    const textX = Math.min(
      Math.max(x - textWidth / 2, textPadding),
      maxRectX + textPadding
    );

    ctx.fillStyle = this.options.theme.crosshair.tooltip.backgroundColor;
    ctx.rect(
      rectX,
      this.container.offsetHeight - this.xLabelHeight,
      rectWidth,
      textPadding * 2 + 12
    );

    const price = this.visibleScale.pixelToPoint(
      0,
      this.pointerY,
      this.getContext("main").canvas
    ).price;
    const decimals = this.estimatePriceLabelDecimalPlaces(30);
    let priceText = "";
    const pointerPane = this.pointerPane;
    const paneIndicator = this.indicatorByPane.get(pointerPane);

    if (pointerPane === this.mainPane || !paneIndicator) {
      priceText = this.options.formatter.formatTooltipPrice(price, decimals);
    } else {
      priceText = paneIndicator.getCrosshairValue(
        this.pointerTime,
        pointerPane.getRelativeY(this.pointerY)
      );
    }
    const priceRectWidth = this.getLogicalCanvas("y-label").width;
    const priceMaxRectX = this.l(ctx.canvas.width) - priceRectWidth;
    const priceRectX = priceMaxRectX;
    const priceTextX = priceMaxRectX + 10;

    ctx.rect(
      priceRectX,
      Math.max(this.pointerY - textPadding / 2 - 6, 1 + textPadding / 2 - 6),
      priceRectWidth,
      textPadding + 12
    );
    ctx.fill();

    ctx.font = `${this.options.theme.crosshair.tooltip.fontSize}px ${this.options.theme.crosshair.tooltip.font}, monospace`;
    ctx.fillStyle = this.options.theme.crosshair.tooltip.color;
    ctx.fillText(
      text,
      textX,
      this.container.offsetHeight - this.xLabelHeight + textPadding * 2
    );
    ctx.fillText(
      priceText,
      priceTextX,
      Math.max(this.pointerY + textPadding / 2, textPadding + 6)
    );

    ctx.font = `${this.options.theme.crosshair.infoLine.fontSize}px ${this.options.theme.crosshair.infoLine.font}, monospace`;

    const p = this.crosshairDataPoint!;

    const labels =
      this.options.theme.crosshair.infoLine.labels[this.options.locale] ||
      this.options.theme.crosshair.infoLine.labels["*"];

    let ohlcTextX = 10;
    const spacing = 10;

    for (const key of this.controller.getCrosshairValues()) {
      if (key === "volume" && !this.options.volume) {
        continue;
      }
      const price = p[key];
      if (price == undefined) continue;
      let ohlcText = this.options.formatter.formatTooltipPrice(price, decimals);
      if (key === "volume") {
        ohlcText = this.options.formatter.formatVolume(price, p.close ?? 1);
      }

      const label = labels[crosshairLabelIndex[key]];
      const labelWidth = ctx.measureText(label).width;
      const valueWidth = ctx.measureText(ohlcText).width;
      if (ohlcTextX + labelWidth + valueWidth > this.getDrawingSize().width)
        break;

      ctx.fillStyle = this.options.theme.crosshair.infoLine.color;
      ctx.fillText(
        label,
        ohlcTextX,
        this.options.theme.crosshair.tooltip.fontSize + 10
      );
      ohlcTextX += labelWidth;

      if (p.open != undefined && p.close != undefined) {
        ctx.fillStyle =
          p.open! > p.close!
            ? this.options.theme.crosshair.infoLine.downColor
            : this.options.theme.crosshair.infoLine.upColor;
      }
      ctx.fillText(
        ohlcText,
        ohlcTextX,
        this.options.theme.crosshair.tooltip.fontSize + 10
      );
      ohlcTextX += valueWidth + spacing;
    }

    this.refreshIndicatorLabels(this.pointerTime);
  }

  /**
   * Properly dispose the chart.
   */
  public dispose() {
    if (this.disposed) return;
    this.disposed = true;

    const indicators = [...this.indicators, ...this.paneledIndicators];
    const plugins = [...this.plugins].reverse();

    this.stopPaneResize();
    for (const dispose of this.eventDisposers.splice(0)) dispose();
    for (const indicator of indicators) {
      this.disposeExtensionScope(indicator);
      try {
        indicator.detach();
      } finally {
        indicator.releaseAttachment();
      }
    }
    for (const plugin of plugins) {
      this.disposeExtensionScope(plugin);
      plugin.detach?.();
    }
    this.indicators.length = 0;
    this.paneledIndicators.length = 0;
    this.plugins.length = 0;
    this.priceAxisAnnotations.clear();
    this.paneByIndicator.clear();
    this.indicatorByPane.clear();
    this.removeAllListeners();
    this.resizeObserver.unobserve(this.container);
    this.resizeObserver.disconnect();
    for (const divider of this.paneDividerHandles.splice(0)) {
      divider.destroy();
    }
    this.canvases.forEach((canvas) => canvas.remove());
    this.overlay.destroy();
    this.container.remove();
    this.canvases.clear();
  }

  /**
   * Estimate the number of decimal places needed for the price labels.
   *
   * @param priceRange    price range
   * @param canvasHeight  canvas height
   * @param labelSpacing  label spacing
   * @returns             number of decimal places needed
   */
  protected estimatePriceLabelDecimalPlaces(labelSpacing: number) {
    const labels = this.calculateYAxisLabels(labelSpacing);
    let stepSize = Infinity;

    for (let i = 1; i < labels.length; i++) {
      const step = Math.abs(labels[i].value - labels[i - 1].value);
      if (step > 0) {
        stepSize = Math.min(stepSize, step);
      }
    }

    if (!Number.isFinite(stepSize)) return 0;

    for (let decimals = 0; decimals <= 6; decimals++) {
      const scaledStep = stepSize * 10 ** decimals;
      if (Math.abs(Math.round(scaledStep) - scaledStep) < 1e-8) {
        return decimals;
      }
    }

    return 6;
  }

  protected mapDataToStepSize(
    data: readonly ChartData[],
    stepSize: number
  ): readonly ChartData[] {
    return DataStore.merge(data, stepSize);
  }

  protected transformNewData(data: ChartData): boolean {
    const bucketTime = DataStore.bucketTime(data.time, this.options.stepSize);
    const isNewData = this.dataStore.merge(data, this.options.stepSize);
    const dataIndex = this.dataStore.indexOfTime(bucketTime);
    const storedData = this.dataStore.get(dataIndex)!;

    this.dataScale.addDataPoint(storedData);

    return isNewData;
  }

  private calculateYAxisLabels(labelSpacing: number) {
    return calculatePriceYAxisLabels({
      yMin: this.visibleScale.getYMin(),
      yMax: this.visibleScale.getYMax(),
      canvasHeight: this.getLogicalCanvas("y-label").height,
      fontSize: this.options.theme.yAxis.fontSize,
      labelSpacing
    });
  }

  protected calculateStepSize(range: number, maxLabels: number) {
    return calculatePriceStepSize(range, maxLabels);
  }

  private getXAxisLabels(ctx: CanvasRenderingContext2D) {
    const canvasWidth = ctx.canvas.width - this.p(this.yLabelWidth);
    const logicalCanvasWidth = this.l(canvasWidth);
    const padding = 20;
    const targetTickCount = Math.max(2, Math.floor(logicalCanvasWidth / 90));
    const labels = this.timeTickGenerator.generate({
      times: this.dataStore.times(),
      visibleRange: this.visibleIndexRange,
      formatter: this.options.formatter,
      targetTickCount
    });

    const drawnLabels: { start: number; end: number }[] = [];
    const visibleLabels: Array<{
      label: string;
      x: number;
      start: number;
    }> = [];

    labels.sort((a, b) => b.priority - a.priority);

    labels.forEach((label) => {
      const x = this.dataScale.getTimeScale().project(label.time, {
        canvas: { width: canvasWidth, height: 0 },
        barAlignment: this.getTimeAnchorAlignment()
      });

      const textWidth = ctx.measureText(label.label).width;
      const labelPos = { start: x - textWidth / 2, end: x + textWidth / 2 };

      const overlaps = drawnLabels.some(
        (drawnLabel) =>
          labelPos.start < drawnLabel.end + padding &&
          labelPos.end > drawnLabel.start - padding
      );

      if (!overlaps && labelPos.end < logicalCanvasWidth) {
        if (labelPos.start >= 0) {
          visibleLabels.push({
            label: label.label,
            x,
            start: labelPos.start
          });
        }

        drawnLabels.push(labelPos);
      }
    });

    return visibleLabels;
  }

  drawYAxis(): void {
    const yAxisValues = this.calculateYAxisLabels(30);

    const ctx = this.getContext("y-label");
    const sizes = this.getLogicalCanvas("y-label");
    ctx.fillStyle = this.options.theme.yAxis.backgroundColor;
    ctx.fillRect(0, 0, sizes.width, sizes.height);

    ctx.fillStyle = this.options.theme.yAxis.color;
    ctx.font = `${this.options.theme.yAxis.fontSize}px ${this.options.theme.xAxis.font}, monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i < yAxisValues.length; i++) {
      const value = yAxisValues[i];
      const y = value.position;
      if (y - this.options.theme.yAxis.fontSize < 0) continue;
      if (y + this.options.theme.yAxis.fontSize > sizes.height) continue;
      const text = this.options.formatter.formatPrice(value.value);
      const textWidth = ctx.measureText(text).width;

      ctx.fillText(
        text,
        (this.l(ctx.canvas.width) - textWidth) / 2 + textWidth,
        y
      );
    }
  }

  drawXAxis(): void {
    const ctx = this.getContext("x-label");
    const sizes = this.getLogicalCanvas("x-label");

    // Setting up the canvas
    ctx.fillStyle = this.options.theme.xAxis.backgroundColor;
    ctx.fillRect(0, 0, sizes.width, sizes.height);

    // Drawing the axis line
    ctx.strokeStyle = this.options.theme.xAxis.separatorColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(sizes.width, 0);
    ctx.stroke();

    // Setting text properties
    ctx.fillStyle = this.options.theme.xAxis.color;
    ctx.font = `${this.options.theme.xAxis.fontSize}px ${this.options.theme.xAxis.font}, monospace`;
    ctx.textBaseline = "middle";

    const labels = this.getXAxisLabels(ctx);
    this.lastXGridCoords = freezeSnapshot(labels.map((label) => label.x));

    for (const label of labels) {
      ctx.fillText(label.label, label.start, sizes.height - 15);
    }
  }

  private lastVisibleDataPoints: readonly ChartData[] = Object.freeze([]);

  recalculateVisibleScale() {
    this.refreshIndexBounds();
    const visibleTimeRange = this.getVisibleTimeRange();
    const visibleDataPoints = this.dataStore.visibleIndexSlice(
      this.visibleIndexRange.from - 1,
      this.visibleIndexRange.to + 1
    );

    for (const indicator of this.indicators) {
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

    this.lastVisibleDataPoints = freezeSnapshot(visibleDataPoints);
    return this.lastVisibleDataPoints;
  }

  getLastVisibleDataPoints(): readonly ChartData[] {
    return this.lastVisibleDataPoints;
  }

  getLastXGridCoords(): readonly number[] {
    return this.lastXGridCoords;
  }

  private redrawScheduled = false;
  private redrawParts = new Set<RenderLayer>();

  public requestRedraw(
    part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>,
    immediate = false
  ) {
    this.addRedrawParts(part);
    if (this.restoringState) return;

    if (immediate) {
      this.flushRedraw();
      return;
    }

    if (this.redrawScheduled) {
      // A redraw is already scheduled, the parts to redraw are accumulated
      return;
    }

    this.redrawScheduled = true;

    requestAnimationFrame(() => {
      // Perform the redraw for the requested parts
      this.flushRedraw();

      // Reset for the next redraw cycle
      this.redrawScheduled = false;

      // If additional parts were requested for redraw while the current frame was being processed,
      // They are already added to redrawParts, so we can immediately schedule another redraw if needed
      if (this.redrawParts.size > 0) {
        this.requestRedraw([...this.redrawParts]);
      }
    });
  }

  private addRedrawParts(
    part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>
  ) {
    const parts = Array.isArray(part) ? part : [part];

    for (const p of parts) {
      this.redrawParts.add(p);
    }
  }

  private flushRedraw() {
    const layers = new Set(this.redrawParts);
    this.redrawParts.clear();
    this.redraw(layers);
  }
}

function cloneAndFreeze<T>(value: T): DeepReadonly<T> {
  const clone =
    typeof structuredClone === "function"
      ? structuredClone(value)
      : (JSON.parse(JSON.stringify(value)) as T);
  return freezeDeep(clone);
}

function freezeDeep<T>(value: T): DeepReadonly<T> {
  if (value == null || typeof value !== "object") {
    return value as DeepReadonly<T>;
  }

  for (const nested of Object.values(value)) {
    freezeDeep(nested);
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

function freezeSnapshot<T>(values: T[]): readonly T[] {
  return Object.freeze(values);
}

function indexStateContributors(
  contributors: readonly ChartStateContributor[]
): Map<string, ChartStateContributor> {
  const indexed = new Map<string, ChartStateContributor>();
  for (const contributor of contributors) {
    if (typeof contributor.key !== "string" || contributor.key.length === 0) {
      throw new Error("Chart state contributors must have a non-empty key.");
    }
    if (indexed.has(contributor.key)) {
      throw new Error(
        `Duplicate chart state contributor key "${contributor.key}".`
      );
    }
    indexed.set(contributor.key, contributor);
  }
  return indexed;
}

function validateChartState(state: unknown): ChartState {
  if (!isPlainRecord(state)) {
    throw new Error("Invalid chart state: expected an object.");
  }
  if (!("version" in state) || typeof state.version !== "number") {
    throw new Error("Invalid chart state: version must be a number.");
  }
  if (state.version !== CHART_STATE_VERSION) {
    throw new Error(
      `Unsupported chart state version "${state.version}"; expected ${CHART_STATE_VERSION}.`
    );
  }
  if (!isPlainRecord(state.core)) {
    throw new Error("Invalid chart state: core must be an object.");
  }
  if (typeof state.core.type !== "string" || state.core.type.length === 0) {
    throw new Error("Invalid chart state: core.type must not be empty.");
  }
  const timeRange = validateChartStateTimeRange(
    state.core.timeRange,
    "core.timeRange",
    true
  );
  if (
    typeof state.core.stepSize !== "number" ||
    !Number.isFinite(state.core.stepSize) ||
    state.core.stepSize <= 0
  ) {
    throw new Error("Invalid chart state: core.stepSize must be positive.");
  }
  if (
    typeof state.core.maxZoom !== "number" ||
    !Number.isFinite(state.core.maxZoom) ||
    state.core.maxZoom <= 0
  ) {
    throw new Error("Invalid chart state: core.maxZoom must be positive.");
  }
  if (typeof state.core.volume !== "boolean") {
    throw new Error("Invalid chart state: core.volume must be a boolean.");
  }

  const visibleRange = validateChartStateTimeRange(
    state.visibleRange,
    "visibleRange",
    false
  ) as TimeRange;
  if (visibleRange.end <= visibleRange.start) {
    throw new Error(
      "Invalid chart state: visibleRange.end must be greater than start."
    );
  }
  if (!Array.isArray(state.panes) || state.panes.length === 0) {
    throw new Error("Invalid chart state: panes must be a non-empty array.");
  }
  const paneIds = new Set<number>();
  const panes = state.panes.map((pane, index): ChartPaneState => {
    if (!isPlainRecord(pane)) {
      throw new Error(
        `Invalid chart state: panes[${index}] must be an object.`
      );
    }
    if (!Number.isInteger(pane.id) || (pane.id as number) < 0) {
      throw new Error(
        `Invalid chart state: panes[${index}].id must be a non-negative integer.`
      );
    }
    if (paneIds.has(pane.id as number)) {
      throw new Error(`Chart state contains duplicate pane id "${pane.id}".`);
    }
    paneIds.add(pane.id as number);
    if (
      typeof pane.height !== "number" ||
      !Number.isFinite(pane.height) ||
      pane.height < 0
    ) {
      throw new Error(
        `Invalid chart state: panes[${index}].height must be non-negative.`
      );
    }
    if (
      pane.indicatorInstanceId !== undefined &&
      (typeof pane.indicatorInstanceId !== "string" ||
        pane.indicatorInstanceId.length === 0)
    ) {
      throw new Error(
        `Invalid chart state: panes[${index}].indicatorInstanceId must not be empty.`
      );
    }
    return {
      id: pane.id as number,
      height: pane.height,
      ...(pane.indicatorInstanceId === undefined
        ? {}
        : { indicatorInstanceId: pane.indicatorInstanceId })
    };
  });

  if (!Array.isArray(state.indicators)) {
    throw new Error("Invalid chart state: indicators must be an array.");
  }
  const indicators = state.indicators.map(
    (indicator, index) =>
      cloneJSONStateValue(
        indicator,
        `Chart state indicators[${index}]`
      ) as unknown as IndicatorState
  );

  let contributions: Record<string, IndicatorStateValue> | undefined;
  if (state.contributions !== undefined) {
    if (!isPlainRecord(state.contributions)) {
      throw new Error("Invalid chart state: contributions must be an object.");
    }
    contributions = {};
    for (const [key, value] of Object.entries(state.contributions)) {
      contributions[key] = cloneJSONStateValue(
        value,
        `Chart state contribution "${key}"`
      );
    }
  }

  return {
    version: CHART_STATE_VERSION,
    core: {
      type: state.core.type,
      timeRange,
      stepSize: state.core.stepSize,
      maxZoom: state.core.maxZoom,
      volume: state.core.volume
    },
    visibleRange,
    panes,
    indicators,
    ...(contributions ? { contributions } : {})
  };
}

function validateChartStateTimeRange(
  value: unknown,
  path: string,
  allowAuto: true
): TimeRange | "auto";
function validateChartStateTimeRange(
  value: unknown,
  path: string,
  allowAuto: false
): TimeRange;
function validateChartStateTimeRange(
  value: unknown,
  path: string,
  allowAuto: boolean
): TimeRange | "auto" {
  if (allowAuto && value === "auto") return value;
  if (
    !isPlainRecord(value) ||
    typeof value.start !== "number" ||
    !Number.isFinite(value.start) ||
    typeof value.end !== "number" ||
    !Number.isFinite(value.end) ||
    value.end < value.start
  ) {
    throw new Error(
      `Invalid chart state: ${path} must contain finite start and end values.`
    );
  }
  return { start: value.start, end: value.end };
}

function assertTimeRange(timeRange: TimeRange | "auto") {
  if (timeRange === "auto") return;
  if (
    !Number.isFinite(timeRange.start) ||
    !Number.isFinite(timeRange.end) ||
    timeRange.end < timeRange.start
  ) {
    throw new RangeError(
      "timeRange must contain finite values with end greater than or equal to start."
    );
  }
}

function assertPositiveOption(name: "stepSize" | "maxZoom", value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero.`);
  }
}

function timeRangesEqual(
  left: TimeRange | "auto",
  right: TimeRange | "auto"
) {
  if (left === "auto" || right === "auto") return left === right;
  return left.start === right.start && left.end === right.end;
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) &&
      deepEqual(leftRecord[key], rightRecord[key])
  );
}
