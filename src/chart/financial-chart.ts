import { ChartController } from "../controllers/controller";
import { DataStore } from "../data/data-store";
import { PaneledIndicator, InitParams } from "../indicators/paneled-indicator";
import { Indicator } from "../indicators/indicator";
import {
  DataScaleModel,
  DataScaleTimeOptions
} from "../scales/data-scale-model";
import { TimeScaleRange } from "../scales/time-scale";
import {
  calculateStepSize as calculatePriceStepSize,
  calculateYAxisLabels as calculatePriceYAxisLabels
} from "../scales/ticks/price-ticks";
import { DefaultFormatter, Formatter } from "./formatter";
import { ChartTheme, defaultLightTheme, mergeThemes } from "./themes";
import { ChartData, TimeRange } from "./types";
import { EventEmitter } from "./event-emitter";
import { pixelRatio } from "../utils/screen";

export type DeepConcrete<T> = T extends Function
  ? T
  : T extends object
    ? { [P in keyof T]-?: DeepConcrete<T[P]> }
    : T;

export type ControllerID =
  | "area"
  | "line"
  | "candle"
  | "bar"
  | "hollow-candle"
  | "stepline"
  | "hlc-area";
export type ControllerType = ControllerID | Omit<string, ControllerID>;

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

export interface ChartOptions {
  type: ControllerType;
  stepSize: number;
  maxZoom: number;
  volume: boolean;
  locale?: string;
  formatter?: Formatter;
  theme?: ChartTheme;
  localeValues?: {
    [key: string]: LocaleValues;
  };
}

interface XAxisLabel {
  date: Date;
  displayLabel: string;
  priority: number;
}

type Resizer = {
  resize: (force: boolean) => void;
  ratioResize: () => void;
};

export class FinancialChart extends EventEmitter {
  private static controllers: Map<ControllerType, new () => ChartController> =
    new Map();

  public static registerController<T extends typeof ChartController>(
    controllerClass: T
  ) {
    // @ts-ignore
    if (controllerClass.ID === "default" || !controllerClass.ID) {
      throw new Error("Controller must have a static ID field!");
    }
    // @ts-ignore
    this.controllers.set(controllerClass.ID, controllerClass);
  }

  private readonly types = [
    "main",
    "crosshair",
    "x-label",
    "y-label",
    "indicator"
  ] as const;
  private controller: ChartController;
  protected outsideContainer: HTMLElement;
  protected container: HTMLElement;
  protected indicatorLabelContainer: HTMLElement;
  protected canvases: Map<string, HTMLCanvasElement> = new Map();
  protected contexts: Map<string, CanvasRenderingContext2D> = new Map();
  protected isPanning: boolean = false;
  protected dataStore = new DataStore();
  private originalDataStore = new DataStore();
  protected options: DeepConcrete<ChartOptions>;
  protected visibleIndexRange: TimeScaleRange = { from: 0, to: 1 };
  private indexBounds: TimeScaleRange = { from: 0, to: 1 };
  protected timeRange!: TimeRange;
  protected autoTimeRange = false;
  protected dataScale!: DataScaleModel;
  protected visibleScale: DataScaleModel;
  private resizer!: Resizer;

  protected indicators: Indicator<any, any>[] = [];
  protected panaledIndicators: PaneledIndicator<any, any>[] = [];

  protected yLabelWidth = 80;
  protected xLabelHeight = 30;

  protected pointerTime = -1;
  protected crosshairDataPoint: ChartData | null = null;
  protected pointerY = -1;
  // -1: chart, 0-n indicator index
  protected pointerTarget = -1;

  private lastTouchDistance?: number;
  private lastPointerPosition?: { x: number };
  private resizeObserver: ResizeObserver;

  private isTouchCrosshair = false;
  private isTouchCrosshairTimeout?: any;

  private isTouchCapable = "ontouchstart" in window;

  private xLabelDates: Date[] = [];
  private xLabelCache: Map<number, XAxisLabel> = new Map();
  private allRedrawParts = ["controller", "indicators", "crosshair"] as const;

  private chartHeight: number = 0;
  private indicatorHeight: number = 0;

  private lastXGridCoords: number[] = [];

  getYLabelWidth() {
    return this.yLabelWidth;
  }

  getTimeRange() {
    return this.timeRange;
  }

  getVisibleExtent() {
    return this.visibleScale;
  }

  getTimeScale() {
    return this.visibleScale.getTimeScale();
  }

  getPriceScale() {
    return this.visibleScale.getPriceScale();
  }

  getVolumeScale() {
    return this.visibleScale.getVolumeScale();
  }

  getZoomLevel() {
    return this.getIndexBoundsSpan() / this.getVisibleIndexSpan();
  }

  getPanOffset() {
    return 0;
  }

  getController() {
    return this.controller;
  }

  getOptions() {
    return this.options;
  }

  getData() {
    return this.dataStore.toArray();
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

  private getPixelPerIndex() {
    return this.getDrawingSize().width / this.getVisibleIndexSpan();
  }

  private isPinnedToRightEdge() {
    return Math.abs(this.visibleIndexRange.to - this.indexBounds.to) < 1e-6;
  }

  private resetVisibleIndexRange() {
    this.refreshIndexBounds({ reset: true });
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

    if (options.reset) {
      this.visibleIndexRange = {
        ...this.indexBounds
      };
    } else if (options.preserveRightEdge) {
      const clampedSpan = Math.min(span, this.getIndexBoundsSpan());
      this.visibleIndexRange = {
        from: this.indexBounds.to - clampedSpan,
        to: this.indexBounds.to
      };
    }

    this.clampVisibleIndexRange();
    this.syncTimeScales();
  }

  private setVisibleIndexRange(range: TimeScaleRange) {
    this.visibleIndexRange = range;
    this.clampVisibleIndexRange();
    this.syncTimeScales();
  }

  private clampVisibleIndexRange() {
    const boundsSpan = this.getIndexBoundsSpan();
    const span = Math.min(this.getVisibleIndexSpan(), boundsSpan);
    let from = this.visibleIndexRange.from;
    let to = from + span;

    if (to > this.indexBounds.to) {
      to = this.indexBounds.to;
      from = to - span;
    }

    if (from < this.indexBounds.from) {
      from = this.indexBounds.from;
      to = from + span;
    }

    this.visibleIndexRange = {
      from,
      to,
      rightOffset: Math.max(0, to - this.dataStore.length)
    };
  }

  private panVisibleIndexRange(dx: number) {
    const pixelPerIndex = this.getPixelPerIndex();
    if (pixelPerIndex <= 0) return;

    const delta = dx / pixelPerIndex;
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

  getIndicators() {
    return this.indicators;
  }

  getPaneledIndicators() {
    return this.panaledIndicators;
  }

  getAllIndicators() {
    return [...this.indicators, ...this.panaledIndicators];
  }

  private redraw() {
    if (this.redrawParts.has("controller")) {
      this.drawController();
    }
    if (this.redrawParts.has("indicators")) {
      this.drawIndicators();
    }
    if (this.redrawParts.has("crosshair")) {
      this.drawCrosshair();
    }
  }

  public changeType(type: ControllerType) {
    this.options.type = type;
    const ControllerClass = FinancialChart.controllers.get(
      this.options.type
    )! as any;

    if (!ControllerClass) {
      throw new Error(`Controller: ${this.options.type} is not registered!`);
    }

    this.controller = new ControllerClass(this, this.options);
    this.dataScale = this.controller.createDataScale(
      this.dataStore.toArray(),
      this.timeRange
    );
    this.visibleScale = this.controller.createDataScale([], {
      start: 0,
      end: 0
    });
    this.syncTimeScales();

    this.recalculateVisibleExtent();

    this.requestRedraw(this.allRedrawParts);
  }

  private processXLabels(): XAxisLabel[] {
    // Calculate the range of the data in days
    let rangeInDays = 0;

    if (this.autoTimeRange && this.dataStore.length > 0) {
      const firstPoint = this.dataStore.get(0)!;
      const lastPoint = this.dataStore.get(this.dataStore.length - 1)!;
      rangeInDays = (lastPoint.time - firstPoint.time) / (1000 * 3600 * 24);
    } else {
      rangeInDays =
        (this.timeRange.end - this.timeRange.start) / (1000 * 3600 * 24);
    }

    return this.xLabelDates.map((date, index, array) => {
      const prevDate = index > 0 ? array[index - 1] : null;
      if (this.xLabelCache.has(date.getTime())) {
        return this.xLabelCache.get(date.getTime())!;
      }

      let ret: XAxisLabel;

      if (rangeInDays > 365) {
        if (prevDate && date.getFullYear() !== prevDate.getFullYear()) {
          ret = {
            date,
            displayLabel: this.options.formatter.formatYear(date.getTime()),
            priority: 4
          };
        } else if (prevDate && date.getMonth() !== prevDate.getMonth()) {
          ret = {
            date,
            displayLabel: this.options.formatter.formatMonth(date.getTime()),
            priority: 3
          };
        } else {
          ret = {
            date,
            displayLabel: this.options.formatter.formatDay(date.getTime()),
            priority: 2
          };
        }
      } else if (rangeInDays > 30) {
        if (prevDate && date.getMonth() !== prevDate.getMonth()) {
          ret = {
            date,
            displayLabel: this.options.formatter.formatMonth(date.getTime()),
            priority: 3
          };
        } else {
          ret = {
            date,
            displayLabel: this.options.formatter.formatDay(date.getTime()),
            priority: 2
          };
        }
      } else if (rangeInDays > 1) {
        ret = {
          date,
          displayLabel: this.options.formatter.formatDay(date.getTime()),
          priority: 2
        };
      } else {
        if (prevDate && date.getDate() !== prevDate?.getDate()) {
          ret = {
            date,
            displayLabel: this.options.formatter.formatDay(date.getTime()),
            priority: 1
          };
        } else {
          ret = {
            date,
            displayLabel: this.options.formatter.formatHour(date.getTime()),
            priority: 1
          };
        }
      }

      this.xLabelCache.set(date.getTime(), ret);
      return ret;
    });
  }

  private findClosestDataPoint(rawPoint: ChartData): ChartData | undefined {
    const time = this.controller.getTimeFromRawDataPoint(rawPoint);
    const closestIndex = this.dataStore.nearestIndex(time);
    return closestIndex === -1 ? undefined : this.dataStore.get(closestIndex);
  }

  getOutsideContainer() {
    return this.outsideContainer;
  }

  constructor(
    container: HTMLElement,
    timeRange: TimeRange | "auto",
    options: ChartOptions
  ) {
    super();
    this.options = options as DeepConcrete<ChartOptions>;

    this.options.volume = this.options.volume || false;
    this.options.locale = this.options.locale || navigator.language || "en-US";
    this.options.formatter = this.options.formatter || new DefaultFormatter();
    this.options.formatter.setLocale(this.options.locale);
    this.options.theme = mergeThemes(defaultLightTheme, this.options.theme);
    this.options.localeValues = {
      ...this.getDefaultLocaleValues(),
      ...this.options.localeValues
    };

    this.outsideContainer = container;
    this.container = document.createElement("div");
    this.container.style.overflow = "hidden";
    this.container.classList.add(
      "financial-charts",
      `financial-charts-${this.options.theme.key}`
    );

    this.container.style.position = "relative";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.backgroundColor = this.options.theme.backgroundColor;
    this.outsideContainer.appendChild(this.container);

    this.indicatorLabelContainer = document.createElement("div");
    this.indicatorLabelContainer.style.zIndex = "101";

    this.indicatorLabelContainer.style.overflow = "auto";
    this.indicatorLabelContainer.style.position = "absolute";
    this.indicatorLabelContainer.style.top =
      this.options.theme.crosshair.infoLine.fontSize + 20 + "px";
    this.indicatorLabelContainer.style.left = "10px";
    this.indicatorLabelContainer.style.width = "fit-content";
    this.container.appendChild(this.indicatorLabelContainer);

    if (timeRange === "auto") {
      this.timeRange = {
        start: 0,
        end: 0
      };
      this.autoTimeRange = true;
    } else {
      this.timeRange = timeRange;
    }

    const ControllerClass = FinancialChart.controllers.get(
      this.options.type
    )! as any;

    if (!ControllerClass) {
      throw new Error(`Controller: ${this.options.type} is not registered!`);
    }

    this.controller = new ControllerClass(this, this.options);
    this.visibleScale = this.controller.createDataScale([], {
      start: 0,
      end: 0
    });
    // Init and scale canveses
    this.types.forEach((type) => this.getCanvas(type));
    const topCanvas = this.getCanvas("crosshair");
    topCanvas.addEventListener("pointerdown", this.onMouseDown);
    topCanvas.addEventListener("pointerup", this.onMouseUp);
    topCanvas.addEventListener("mousemove", this.onMouseMove);
    topCanvas.addEventListener("wheel", this.onWheel, {
      passive: false
    });
    topCanvas.addEventListener("touchstart", this.onTouchStart, {
      passive: false
    });
    topCanvas.addEventListener("touchend", this.onTouchEnd, {
      passive: false
    });
    topCanvas.addEventListener("touchmove", this.onTouchMove, {
      passive: false
    });
    topCanvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
    topCanvas.addEventListener("pointerleave", (e) => {
      if (e.pointerType === "touch") return;
      this.lastPointerPosition = undefined;
      this.lastTouchDistance = undefined;
      this.isPanning = false;
      requestAnimationFrame(() => {
        this.pointerTime = -1;
        this.pointerY = -1;
        this.pointerTarget = -1;
        this.drawCrosshair();
      });
    });

    this.calcSpaceDistribution(this.panaledIndicators.length);

    const createResizers = (): Resizer => {
      let alreadyResized = false;
      let oldRatio = pixelRatio();

      const resizer = (force: boolean) => {
        if (alreadyResized && !force) {
          alreadyResized = false;
          return;
        }
        this.calcSpaceDistribution(this.panaledIndicators.length);
        this.resizeCanvases();

        for (let i = 0; i < this.panaledIndicators.length; i++) {
          const indicator = this.panaledIndicators[i];
          indicator.resize({
            width: this.container.offsetWidth,
            height: this.indicatorHeight,
            y: this.chartHeight + this.indicatorHeight * i,
            devicePixelRatio: pixelRatio(),
            x: 0
          });
        }

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

          this.refreshIndexBounds({
            reset: span === this.getIndexBoundsSpan(),
            preserveRightEdge,
            span
          });

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

    window.addEventListener("resize", this.resizer.ratioResize);

    this.resizeObserver = new ResizeObserver(() => this.resizer.resize(false));
    this.resizeObserver.observe(this.container);
  }

  private getDefaultLocaleValues() {
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
        this.dataStore.toArray(),
        this.timeRange,
        this.getTimeScaleOptions()
      );
    }
  }

  public updateTheme(theme: ChartTheme) {
    this.container.classList.remove(
      `financial-charts-${this.options.theme.key}`
    );
    this.options.theme = mergeThemes(this.options.theme, theme);
    this.container.style.backgroundColor = this.options.theme.backgroundColor;
    if (this.dataStore.length > 0) {
      this.requestRedraw(this.allRedrawParts);
    }
    this.container.classList.add(`financial-charts-${theme.key}`);
  }

  public setVolumeDraw(draw: boolean) {
    this.options.volume = draw;
    this.requestRedraw(this.allRedrawParts);
  }

  public updateCoreOptions(
    timeRange: TimeRange | "auto",
    stepSize: number,
    maxZoom: number
  ) {
    this.options.maxZoom = maxZoom;
    this.options.stepSize = stepSize;

    this.visibleIndexRange = { from: 0, to: 1 };
    this.indexBounds = { from: 0, to: 1 };
    this.isPanning = false;
    this.pointerTime = -1;
    this.pointerY = -1;
    this.pointerTarget = -1;
    this.lastTouchDistance = undefined;
    this.lastPointerPosition = undefined;
    this.isTouchCrosshair = false;
    this.isTouchCrosshairTimeout = undefined;
    if (timeRange !== "auto") {
      this.autoTimeRange = false;
      this.timeRange = timeRange;
    }

    this.xLabelCache.clear();
    this.xLabelDates = [];

    if (this.originalDataStore.length == 0) {
      this.autoTimeRange = timeRange === "auto";
      this.dataScale = this.controller.createDataScale([], this.timeRange);
      this.visibleScale = this.controller.createDataScale([], {
        start: 0,
        end: 0
      });
      this.resetVisibleIndexRange();
      return;
    }

    this.dataStore = new DataStore(
      this.mapDataToStepSize(this.originalDataStore.toArray(), stepSize)
    );

    if (timeRange === "auto") {
      this.autoTimeRange = true;
      this.updateAutoTimeRange(false);
    }

    this.dataScale = this.controller.createDataScale(
      this.dataStore.toArray(),
      this.timeRange
    );
    this.visibleScale = this.controller.createDataScale([], {
      start: 0,
      end: 0
    });
    this.resetVisibleIndexRange();
    this.recalculateVisibleExtent();

    for (const d of this.dataStore.toArray()) {
      if (d.time < this.timeRange.start) continue;
      this.xLabelDates.push(new Date(d.time));
    }

    this.requestRedraw(this.allRedrawParts);
  }

  public updateLocale(
    locale: string,
    values?: {
      [key: string]: LocaleValues;
    }
  ) {
    this.options.locale = locale;
    this.options.formatter.setLocale(locale);
    this.xLabelCache.clear();
    this.xLabelDates = [];
    for (const d of this.dataStore.toArray()) {
      if (d.time < this.timeRange.start) continue;
      this.xLabelDates.push(new Date(d.time));
    }

    if (values) {
      this.options.localeValues = {
        ...this.getDefaultLocaleValues(),
        ...values
      };
    }

    for (const indicator of this.indicators) {
      indicator.updateLocale();
    }
    for (const indicator of this.panaledIndicators) {
      indicator.updateLocale();
    }

    this.requestRedraw(this.allRedrawParts);
  }

  private onMouseDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    this.lastPointerPosition = { x: event.clientX };
  };

  private onMouseUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (!this.isPanning) {
      const topCanvas = this.getContext("crosshair").canvas;
      const rect = topCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rawPoint = this.dataScale.pixelToPoint(
        x,
        y,
        this.getContext("main").canvas
      );
      const closestDataPoint = this.findClosestDataPoint(rawPoint);
      if (!closestDataPoint) return;
      this.emit("click", { event: e, point: closestDataPoint });
    }
    this.lastPointerPosition = undefined;
    this.isPanning = false;
  };

  /**
   * Get the number of pixels per millisecond-sized bar slot.
   *
   * @returns pixels per millisecond-sized bar slot
   */
  getPixelPerMs(): number {
    return this.getPixelPerIndex() / this.options.stepSize;
  }

  private onMouseMove = (event: MouseEvent) => {
    if (this.dataStore.length == 0) return;
    if (this.lastPointerPosition) {
      this.isPanning = true;
      const dx = event.clientX - this.lastPointerPosition.x;
      this.panVisibleIndexRange(dx);
      this.requestRedraw(["controller", "indicators"]);
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

    this.requestRedraw(this.allRedrawParts);
  };

  private drawController() {
    const ctx = this.getContext("main");
    const sizes = this.getLogicalCanvas("main");
    ctx.clearRect(0, 0, sizes.width, sizes.height);
    ctx.fillStyle = this.options.theme.backgroundColor;
    ctx.fillRect(0, 0, sizes.width, sizes.height);

    this.recalculateVisibleExtent();

    this.drawYAxis();
    this.drawXAxis();

    if (this.options.volume) {
      this.drawVolumeBars();
    }
    this.controller.draw();
  }

  protected onZoom() {
    this.drawCrosshair();
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
          this.pointerY = -1;
          this.pointerTime = -1;
          this.pointerTarget = -1;
          this.requestRedraw("crosshair");
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
      requestAnimationFrame(() => {
        const rect =
          this.getContext("crosshair").canvas.getBoundingClientRect();
        this.drawController();
        this.drawIndicators();
        if (!this.isTouchCrosshair) return;
        this.pointerMove({
          x: event.touches[0].clientX - rect.left,
          y: event.touches[0].clientY - rect.top
        });
      });
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
      requestAnimationFrame(() => {
        this.drawController();
        this.drawIndicators();
      });
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
    type: (typeof this.types)[number],
    canvas: HTMLCanvasElement
  ) {
    const devicePixelRatio = pixelRatio();
    canvas.style.userSelect = "none";
    // @ts-ignore
    canvas.style.webkitTapHighlightColor = "transparent";

    if (type === "y-label") {
      canvas.style.right = "0px";
      canvas.width = this.yLabelWidth * devicePixelRatio;
      canvas.style.width = this.yLabelWidth + "px";
    } else if (type === "x-label" || type === "crosshair") {
      canvas.width = this.container.offsetWidth * devicePixelRatio;
      canvas.style.width = this.container.offsetWidth + "px";
    } else {
      canvas.width =
        this.container.offsetWidth * devicePixelRatio -
        this.yLabelWidth * devicePixelRatio;
      canvas.style.width = this.container.offsetWidth - this.yLabelWidth + "px";
    }

    if (type === "x-label") {
      canvas.style.bottom = "0px";
      canvas.height = this.xLabelHeight * devicePixelRatio;
      canvas.style.height = this.xLabelHeight + "px";
    } else if (type === "crosshair") {
      canvas.height = this.container.offsetHeight * devicePixelRatio;
      canvas.style.height = this.container.offsetHeight + "px";
    } else {
      canvas.height = this.chartHeight * devicePixelRatio;
      canvas.style.height = this.chartHeight + "px";
    }
  }

  protected getCanvas(type: (typeof this.types)[number]): HTMLCanvasElement {
    const canvas: HTMLCanvasElement =
      this.canvases.get(type) || document.createElement("canvas");

    if (!this.canvases.has(type)) {
      canvas.style.position = "absolute";
      canvas.style.zIndex =
        type === "crosshair" ? "100" : type === "indicator" ? "50" : "1";
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

      const devicePixelRatio = pixelRatio();

      if (this.contexts.has(type)) {
        this.adjustCanvas(type, canvas);
        const ctx = this.getContext(type);
        ctx.scale(devicePixelRatio, devicePixelRatio);
      } else {
        this.adjustCanvas(type, canvas);
        const ctx = this.getContext(type);
        ctx.scale(devicePixelRatio, devicePixelRatio);
      }
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

  getContext(type: (typeof this.types)[number]): CanvasRenderingContext2D {
    if (!this.contexts.has(type)) {
      const ctx = this.getCanvas(type).getContext("2d")!;
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
  getLogicalCanvas(type: (typeof this.types)[number]) {
    const ratio = pixelRatio();
    const width = this.getContext(type).canvas.width / ratio;
    const height = this.getContext(type).canvas.height / ratio;
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
   * Get the currently visible time range.
   * This is the time range that is visible on the screen.
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
   * Draws/Redraws the whole chart with the given data.
   * If you only have one sequentially new point, use drawNewChartPoint
   * instead for better performance.
   *
   * @param data chart data to draw
   */
  public draw(data: ChartData[]) {
    if (data.length == 0) return;
    this.calcSpaceDistribution(this.panaledIndicators.length);
    this.originalDataStore = new DataStore(data);
    this.dataStore = new DataStore(
      this.mapDataToStepSize(data, this.options.stepSize)
    );

    if (this.autoTimeRange) {
      this.updateAutoTimeRange(false);
    }

    this.dataScale = this.controller.createDataScale(
      this.dataStore.toArray(),
      this.timeRange
    );

    this.resetVisibleIndexRange();
    this.recalculateVisibleExtent();

    this.xLabelDates = [];

    for (const d of this.dataStore.toArray()) {
      if (d.time < this.timeRange.start) continue;
      this.xLabelDates.push(new Date(d.time));
    }

    this.requestRedraw(this.allRedrawParts);
  }

  /**
   * Draws the next point to the chart.
   * If you have only one new point, use this
   * for better performance.
   *
   * @param data chart data to draw
   */
  public drawNextPoint(data: ChartData) {
    const preserveRightEdge = this.isPinnedToRightEdge();
    const span = this.getVisibleIndexSpan();

    this.originalDataStore.append(data);
    this.transformNewData(data);

    if (this.autoTimeRange) {
      this.updateAutoTimeRange(true);
    }

    this.refreshIndexBounds({ preserveRightEdge, span });
    this.requestRedraw(this.allRedrawParts);
  }

  private recalcPaneledIndicators() {
    this.calcSpaceDistribution(this.panaledIndicators.length);
    for (let i = 0; i < this.panaledIndicators.length; i++) {
      const indicator = this.panaledIndicators[i];
      indicator.resize({
        width: this.container.offsetWidth,
        height: this.indicatorHeight,
        y: this.chartHeight + this.indicatorHeight * i,
        devicePixelRatio: pixelRatio(),
        x: 0
      });
    }
    this.resizeCanvases();
  }

  /**
   * Adds and draws a new indicator.
   *
   * @param indicator indicator to draw
   */
  public addIndicator(indicator: Indicator<any, any>) {
    if (indicator instanceof PaneledIndicator) {
      // Main chart must have at least 25% of the height
      // every indicator by default gets 25% of the height
      // if it is possible. Otherwise they equally get less.

      this.calcSpaceDistribution(this.panaledIndicators.length + 1);

      const params: InitParams = {
        devicePixelRatio: pixelRatio(),
        height: this.indicatorHeight,
        width: this.container.offsetWidth,
        x: 0,
        y:
          this.chartHeight +
          this.indicatorHeight * this.panaledIndicators.length
      };

      indicator.setChart(this);
      indicator.init(params);

      this.panaledIndicators.push(indicator);

      this.container.appendChild(indicator.getContainer());

      this.recalcPaneledIndicators();

      this.requestRedraw(this.allRedrawParts);
      indicator.updateLabel();
    } else {
      this.indicators.push(indicator);
      indicator.setChart(this);
      this.requestRedraw(this.allRedrawParts);
      this.indicatorLabelContainer.appendChild(indicator.getLabelContainer());
      indicator.updateLabel();
    }
  }

  private calcSpaceDistribution(indicatorCount: number) {
    const height = this.container.offsetHeight - this.xLabelHeight;
    // If the height of the chart is less than 25% of the height of the indicators
    const th = height / (indicatorCount + 1) > height * 0.25;

    const indicatorHeight = !th
      ? (height * 0.75) / indicatorCount
      : height * 0.25;

    this.chartHeight = height - indicatorHeight * indicatorCount;
    this.indicatorHeight = indicatorHeight;
  }

  /**
   * Removes an indicator from the chart and redraws the indicators
   * to reflect the changes.
   *
   * @param indicator indicator to remove
   */

  public removeIndicator(indicator: Indicator<any, any>) {
    if (indicator instanceof PaneledIndicator) {
      this.container.removeChild(indicator.getContainer());
      this.panaledIndicators = this.panaledIndicators.filter(
        (i) => i !== indicator
      );
      this.recalcPaneledIndicators();
      this.requestRedraw(this.allRedrawParts);
    } else {
      this.visibleScale.removeModifier(indicator);
      this.indicatorLabelContainer.removeChild(indicator.getLabelContainer());
      this.indicators = this.indicators.filter((i) => i !== indicator);
      this.requestRedraw(this.allRedrawParts);
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
    if (e.y <= this.chartHeight) {
      this.pointerTarget = -1;
    } else {
      this.pointerTarget = Math.floor(
        (e.y - this.chartHeight) / this.indicatorHeight
      );
    }

    this.requestRedraw("crosshair");
  }

  private drawVolumeBars() {
    const ctx = this.getContext("main");
    const spacing = 0.1;
    const pixelPerMs = this.getPixelPerMs();
    const visibleDataPoints = this.recalculateVisibleExtent();
    const candleSpacing = this.options.stepSize * pixelPerMs * spacing;
    const candleWidth = this.options.stepSize * pixelPerMs - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

    const timeRange = this.getTimeRange();
    const timeScale = this.getTimeScale();
    const volumeScale = this.getVolumeScale();
    const scaleOptions = {
      canvas: ctx.canvas,
      zoomLevel: this.getZoomLevel(),
      panOffset: this.getPanOffset(),
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
    if (this.dataStore.length == 0) return;
    const ctx = this.getContext("indicator");
    const sizes = this.getLogicalCanvas("indicator");

    ctx.clearRect(0, 0, sizes.width, sizes.height);

    for (const indicator of this.indicators) {
      indicator.draw();
    }
    for (const indicator of this.panaledIndicators) {
      indicator.draw();
    }
  }

  private drawCrosshair(): void {
    const ctx = this.getContext("crosshair");
    const sizes = this.getLogicalCanvas("crosshair");
    ctx.clearRect(0, 0, sizes.width, sizes.height);

    if (this.pointerTime === -1) return;
    if (this.pointerY === -1) return;
    if (this.isTouchCapable && !this.isTouchCrosshair) return;

    if (this.pointerY >= this.container.offsetHeight - this.xLabelHeight) {
      this.getContext("crosshair").clearRect(0, 0, sizes.width, sizes.height);
      return;
    }

    const x = this.getTimeScale().project(this.pointerTime, {
      canvas: this.getContext("main").canvas,
      barAlignment: "center"
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

    if (this.pointerTarget === -1) {
      priceText = this.options.formatter.formatTooltipPrice(price, decimals);
    } else {
      priceText = this.panaledIndicators[this.pointerTarget].getCrosshairValue(
        this.pointerTime,
        this.pointerY -
          this.chartHeight -
          this.indicatorHeight * this.pointerTarget
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

    const ohlcv = [p.open, p.high, p.low, p.close, p.volume];
    const labels =
      this.options.theme.crosshair.infoLine.labels[this.options.locale] ||
      this.options.theme.crosshair.infoLine.labels["*"];
    const visibleLabels = this.controller.getEffectiveCrosshairValues();

    let ohlcTextX = 10;
    const spacing = 10;

    for (let i = 0; i < ohlcv.length; i++) {
      if (!visibleLabels[i]) continue;
      if (ohlcv.length - 1 === i && !this.options.volume) {
        continue; // Skip volume if not enabled
      }
      const price = ohlcv[i];
      if (price == undefined) continue;
      let ohlcText = this.options.formatter.formatTooltipPrice(price, decimals);
      if (ohlcv.length - 1 === i) {
        ohlcText = this.options.formatter.formatVolume(price, p.close || 1);
      }

      const labelWidth = ctx.measureText(labels[i]).width;
      const valueWidth = ctx.measureText(ohlcText).width;
      if (ohlcTextX + labelWidth + valueWidth > this.getDrawingSize().width)
        break;

      ctx.fillStyle = this.options.theme.crosshair.infoLine.color;
      ctx.fillText(
        labels[i],
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

    for (const indicator of this.panaledIndicators) {
      indicator.updateLabel(this.pointerTime);
    }
    for (const indicator of this.indicators) {
      indicator.updateLabel(this.pointerTime);
    }
  }

  /**
   * Properly dispose the chart.
   */
  public dispose() {
    const topCanvas = this.getCanvas("crosshair");
    topCanvas.removeEventListener("pointerdown", this.onMouseDown);
    topCanvas.removeEventListener("pointerup", this.onMouseUp);
    topCanvas.removeEventListener("mousemove", this.onMouseMove);
    topCanvas.removeEventListener("touchstart", this.onTouchStart);
    topCanvas.removeEventListener("touchend", this.onTouchEnd);
    topCanvas.removeEventListener("touchmove", this.onTouchMove);
    this.resizeObserver.unobserve(this.container);
    this.resizeObserver.disconnect();
    this.canvases.forEach((canvas) => canvas.remove());
    this.container.remove();
    this.canvases.clear();
    window.removeEventListener("resize", this.resizer.ratioResize);
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
    const priceRange =
      this.visibleScale.getYMax() - this.visibleScale.getYMin();
    const maxLabels = Math.floor(this.getDrawingSize().height / labelSpacing);
    const stepSize = priceRange / maxLabels;

    // Estimate decimal places based on step size
    if (stepSize < 0.00001) {
      return 6; // very small step size
    } else if (stepSize < 0.0001) {
      return 5; // very small step size
    } else if (stepSize < 0.001) {
      return 4;
    } else if (stepSize < 0.01) {
      return 3;
    } else if (stepSize < 0.1) {
      return 2;
    } else if (stepSize < 1) {
      return 1;
    } else {
      return 0; // no decimal places needed
    }
  }

  protected mapDataToStepSize(
    data: ChartData[],
    stepSize: number
  ): ChartData[] {
    return DataStore.merge(data, stepSize);
  }

  protected transformNewData(data: ChartData): boolean {
    const d =
      data.time % this.options.stepSize === 0
        ? data
        : { ...data, time: data.time - (data.time % this.options.stepSize) };

    const isNewData = this.dataStore.merge(d, this.options.stepSize);
    const dataIndex = this.dataStore.indexOfTime(d.time);
    const storedData = this.dataStore.get(dataIndex)!;

    this.dataScale.addDataPoint(storedData);

    if (isNewData) {
      this.xLabelDates.push(new Date(d.time));
    }

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

  drawYAxis(): void {
    const yAxisValues = this.calculateYAxisLabels(30);

    const ctx = this.getContext("y-label");
    const sizes = this.getLogicalCanvas("y-label");
    ctx.fillStyle = this.options.theme.yAxis.backgroundColor;
    ctx.fillRect(0, 0, sizes.width, sizes.height);

    ctx.fillStyle = this.options.theme.yAxis.color;
    ctx.font =
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
      const mainCtx = this.getContext("main");

      mainCtx.lineWidth = this.options.theme.grid.width;
      mainCtx.strokeStyle = this.options.theme.grid.color;
      mainCtx.beginPath();
      mainCtx.moveTo(0, y);
      mainCtx.lineTo(this.getLogicalCanvas("main").width, y);
      mainCtx.stroke();
    }
  }

  drawXAxis(): void {
    this.lastXGridCoords = [];
    const labels = this.processXLabels();
    const ctx = this.getContext("x-label");
    const mainCtx = this.getContext("main");
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
    const canvasWidth = ctx.canvas.width - this.p(this.yLabelWidth);
    const padding = 20;

    let drawnLabels: { start: number; end: number }[] = [];

    labels.sort((a, b) => b.priority - a.priority);

    labels.forEach((label) => {
      const x = this.dataScale.getTimeScale().project(label.date.getTime(), {
        canvas: { width: canvasWidth, height: 0 },
        barAlignment: "center"
      });

      const textWidth = ctx.measureText(label.displayLabel).width;
      const labelPos = { start: x - textWidth / 2, end: x + textWidth / 2 };

      // Check for overlap with already drawn labels
      const overlaps = drawnLabels.some(
        (drawnLabel) =>
          labelPos.start < drawnLabel.end + padding &&
          labelPos.end > drawnLabel.start - padding
      );

      if (!overlaps && labelPos.end < this.l(canvasWidth)) {
        if (labelPos.start >= 0) {
          ctx.fillText(label.displayLabel, labelPos.start, sizes.height - 15);

          // Draw grid line
          mainCtx.lineWidth = this.options.theme.grid.width;
          mainCtx.strokeStyle = this.options.theme.grid.color;
          mainCtx.beginPath();
          mainCtx.moveTo(x, 0);
          mainCtx.lineTo(x, this.l(mainCtx.canvas.height));
          mainCtx.stroke();
          this.lastXGridCoords.push(x);
        }

        drawnLabels.push(labelPos);
      }
    });
  }

  private lastVisibleDataPoints: ChartData[] = [];

  recalculateVisibleExtent() {
    this.refreshIndexBounds();
    const visibleTimeRange = this.getVisibleTimeRange();
    const visibleDataPoints = this.dataStore.visibleIndexSlice(
      this.visibleIndexRange.from - 1,
      this.visibleIndexRange.to + 1
    );

    for (const indicator of this.indicators) {
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

    this.lastVisibleDataPoints = visibleDataPoints;
    return visibleDataPoints;
  }

  getLastVisibleDataPoints() {
    return this.lastVisibleDataPoints;
  }

  getLastXGridCoords() {
    return this.lastXGridCoords;
  }

  private redrawScheduled = false;
  private redrawParts = new Set<"controller" | "crosshair" | "indicators">();

  public requestRedraw(
    part:
      | "controller"
      | "crosshair"
      | "indicators"
      | ReadonlyArray<"controller" | "crosshair" | "indicators">,
    immediate = false
  ) {
    if (Array.isArray(part)) {
      for (const p of part) {
        this.redrawParts.add(p);
      }
    } else {
      this.redrawParts.add(part as any);
    }

    if (immediate) {
      this.redraw();
      return;
    }

    if (this.redrawScheduled) {
      // A redraw is already scheduled, the parts to redraw are accumulated
      return;
    }

    this.redrawScheduled = true;

    requestAnimationFrame(() => {
      // Perform the redraw for the requested parts
      this.redraw();

      // Reset for the next redraw cycle
      this.redrawScheduled = false;
      this.redrawParts.clear();

      // If additional parts were requested for redraw while the current frame was being processed,
      // They are already added to redrawParts, so we can immediately schedule another redraw if needed
      if (this.redrawParts.size > 0) {
        this.requestRedraw(part); // This recursive call ensures we don't ignore recent requests
      }
    });
  }
}
