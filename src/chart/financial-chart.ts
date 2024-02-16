import { ChartController } from "../controllers/controller";
import { DataExtent } from "../extents/data-extent";
import { Indicator } from "../indicators/indicator";
import { DefaultFormatter, Formatter } from "./formatter";
import { ChartTheme, defaultLightTheme, mergeThemes } from "./themes";
import { ChartData, TimeRange } from "./types";

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

export interface ChartOptions {
  type: ControllerType;
  stepSize: number;
  maxZoom: number;
  locale?: string;
  formatter?: Formatter;
  theme?: ChartTheme;
}

type AxisLabel = {
  value: number;
  position: number;
};

interface XAxisLabel {
  date: Date;
  displayLabel: string;
  priority: number;
}

export class FinancialChart {
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
    "indicator",
  ] as const;
  private controller: ChartController;
  protected outsideContainer: HTMLElement;
  protected container: HTMLElement;
  protected canvases: Map<string, HTMLCanvasElement> = new Map();
  protected contexts: Map<string, CanvasRenderingContext2D> = new Map();
  protected isPanning: boolean = false;
  protected data: ChartData[] = [];
  private originalData: ChartData[] = [];
  protected options: DeepConcrete<ChartOptions>;
  protected zoomLevel = 1;
  protected panOffset = 0;
  protected timeRange: TimeRange;
  protected dataExtent!: DataExtent;
  protected visibleExtent: DataExtent;

  protected indicators: Indicator<any, any>[] = [];

  protected yLabelWidth = 80;
  protected xLabelHeight = 30;

  protected pointerTime = -1;
  protected crosshairDataPoint: ChartData | null = null;
  protected pointerY = -1;

  private lastTouchDistance?: number;
  private lastPointerPosition?: { x: number };
  private resizeObserver: ResizeObserver;
  private eventListeners: Map<string, (e: Event, data: ChartData) => any> =
    new Map();

  private isTouchCrosshair = false;
  private isTouchCrosshairTimeout?: NodeJS.Timeout;
  private isTouchCapable = "ontouchstart" in window;
  private xLabelDates: Date[] = [];
  private xLabelCache: Map<number, XAxisLabel> = new Map();

  getTimeRange() {
    return this.timeRange;
  }

  getVisibleExtent() {
    return this.visibleExtent;
  }

  getZoomLevel() {
    return this.zoomLevel;
  }

  getPanOffset() {
    return this.panOffset;
  }

  getController() {
    return this.controller;
  }

  getOptions() {
    return this.options;
  }

  getData() {
    return this.data;
  }

  private redraw() {
    this.controller.draw();
    this.drawIndicators();
    this.drawCrosshair();
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
    this.dataExtent = this.controller.createDataExtent(
      this.data,
      this.timeRange
    );
    this.visibleExtent = this.controller.createDataExtent([], {
      start: 0,
      end: 0,
    });

    this.recalculateVisibleExtent();

    requestAnimationFrame(() => this.redraw());
  }

  private processXLabels(): XAxisLabel[] {
    // Calculate the range of the data in days
    const rangeInDays =
      (this.timeRange.end - this.timeRange.start) / (1000 * 3600 * 24);

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
            priority: 4,
          };
        } else if (prevDate && date.getMonth() !== prevDate.getMonth()) {
          ret = {
            date,
            displayLabel: this.options.formatter.formatMonth(date.getTime()),
            priority: 3,
          };
        } else {
          ret = {
            date,
            displayLabel: this.options.formatter.formatDay(date.getTime()),
            priority: 2,
          };
        }
      } else if (rangeInDays > 30) {
        if (prevDate && date.getMonth() !== prevDate.getMonth()) {
          ret = {
            date,
            displayLabel: this.options.formatter.formatMonth(date.getTime()),
            priority: 3,
          };
        } else {
          ret = {
            date,
            displayLabel: this.options.formatter.formatDay(date.getTime()),
            priority: 2,
          };
        }
      } else if (rangeInDays > 1) {
        ret = {
          date,
          displayLabel: this.options.formatter.formatDay(date.getTime()),
          priority: 2,
        };
      } else {
        if (prevDate && date.getDate() !== prevDate?.getDate()) {
          ret = {
            date,
            displayLabel: this.options.formatter.formatDay(date.getTime()),
            priority: 1,
          };
        } else {
          ret = {
            date,
            displayLabel: this.options.formatter.formatHour(date.getTime()),
            priority: 1,
          };
        }
      }

      this.xLabelCache.set(date.getTime(), ret);
      return ret;
    });
  }

  public setEventListener<E extends Event>(
    event: "click" | "touch-click",
    callback: (e: E, data: ChartData) => any
  ) {
    this.eventListeners.set(event, callback as any);
  }

  private findClosestDataPoint(rawPoint: ChartData): ChartData | undefined {
    const time = this.controller.getTimeFromRawDataPoint(rawPoint);
    // Find the closest data point
    const closestDataPoint = this.data.reduce(
      (prev, curr) =>
        Math.abs(curr.time - time) < Math.abs(prev.time - time) ? curr : prev,
      { time: 0 }
    );
    if (closestDataPoint.time === 0) return;
    return closestDataPoint;
  }

  constructor(
    container: HTMLElement,
    timeRange: TimeRange,
    options: ChartOptions
  ) {
    this.options = options as DeepConcrete<ChartOptions>;

    this.options.locale = this.options.locale || navigator.language || "en-US";
    this.options.formatter = this.options.formatter || new DefaultFormatter();
    this.options.formatter.setLocale(this.options.locale);
    this.options.theme = mergeThemes(defaultLightTheme, this.options.theme);
    this.outsideContainer = container;
    this.container = document.createElement("div");
    this.container.style.position = "relative";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.backgroundColor = this.options.theme.backgroundColor;
    this.outsideContainer.appendChild(this.container);

    this.timeRange = timeRange;

    const ControllerClass = FinancialChart.controllers.get(
      this.options.type
    )! as any;

    if (!ControllerClass) {
      throw new Error(`Controller: ${this.options.type} is not registered!`);
    }

    this.controller = new ControllerClass(this, this.options);
    this.visibleExtent = this.controller.createDataExtent([], {
      start: 0,
      end: 0,
    });
    // Init and scale canveses
    this.types.forEach((type) => this.getCanvas(type));
    const topCanvas = this.getCanvas("crosshair");
    topCanvas.addEventListener("pointerdown", this.onMouseDown);
    topCanvas.addEventListener("pointerup", this.onMouseUp);
    topCanvas.addEventListener("mousemove", this.onMouseMove);
    topCanvas.addEventListener("wheel", this.onWheel, {
      passive: false,
    });
    topCanvas.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    topCanvas.addEventListener("touchend", this.onTouchEnd, {
      passive: false,
    });
    topCanvas.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
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
        this.drawCrosshair();
      });
    });
    this.resizeObserver = new ResizeObserver(() => {
      const oldCanvasSize = this.getDrawingSize().width;
      this.resizeCanvases();
      const newCanvasSize = this.getDrawingSize().width;

      if (this.data.length > 0) {
        requestAnimationFrame(() => {
          // Calculate scale factor
          const scaleFactor = newCanvasSize / oldCanvasSize;

          // Adjust panOffset based on the scale factor
          const newPanOffset = this.panOffset * scaleFactor;

          // Constrain newPanOffset within bounds
          this.panOffset = Math.max(
            0,
            Math.min(newPanOffset, this.getMaxPanOffset())
          );

          this.redraw();
        });
      }
    });
    this.resizeObserver.observe(this.container);
  }

  public updateTheme(theme: ChartTheme) {
    this.options.theme = mergeThemes(this.options.theme, theme);
    this.container.style.backgroundColor = this.options.theme.backgroundColor;
    if (this.data.length > 0) {
      requestAnimationFrame(() => this.redraw());
    }
  }

  public updateCoreOptions(
    timeRange: TimeRange,
    stepSize: number,
    maxZoom: number
  ) {
    this.options.maxZoom = maxZoom;
    this.options.stepSize = stepSize;
    this.timeRange = timeRange;
    this.zoomLevel = 1;
    this.panOffset = 0;
    this.isPanning = false;
    this.pointerTime = -1;
    this.pointerY = -1;
    this.lastTouchDistance = undefined;
    this.lastPointerPosition = undefined;
    this.isTouchCrosshair = false;
    this.isTouchCrosshairTimeout = undefined;
    this.dataExtent = this.controller.createDataExtent(
      this.data,
      this.timeRange
    );
    this.visibleExtent = this.controller.createDataExtent([], {
      start: 0,
      end: 0,
    });
    this.xLabelCache.clear();
    this.xLabelDates = [];

    if (this.originalData.length == 0) return;

    this.data = this.mapDataToStepSize(this.originalData, stepSize);

    for (const d of this.data) {
      if (d.time < this.timeRange.start) continue;
      this.xLabelDates.push(new Date(d.time));
    }

    requestAnimationFrame(() => this.redraw());
  }

  public updateLocale(locale: string) {
    this.options.locale = locale;
    this.options.formatter.setLocale(locale);
    this.xLabelCache.clear();
    this.xLabelDates = [];
    for (const d of this.data) {
      if (d.time < this.timeRange.start) continue;
      this.xLabelDates.push(new Date(d.time));
    }
    requestAnimationFrame(() => this.redraw());
  }

  private onMouseDown = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    this.lastPointerPosition = { x: event.clientX };
  };

  private onMouseUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    if (!this.isPanning && this.eventListeners.has("click")) {
      const topCanvas = this.getContext("crosshair").canvas;
      const rect = topCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rawPoint = this.dataExtent.pixelToPoint(
        x,
        y,
        this.getContext("main").canvas,
        this.zoomLevel,
        this.panOffset
      );
      const closestDataPoint = this.findClosestDataPoint(rawPoint);
      if (!closestDataPoint) return;
      this.eventListeners.get("click")?.(e, closestDataPoint);
    }
    this.lastPointerPosition = undefined;
    this.isPanning = false;
  };

  protected timeToPixel(time: number): number {
    const duration = this.dataExtent.getXMax() - this.dataExtent.getXMin();
    const relativeTime = time - this.timeRange.start;
    const canvasWidth = this.getDrawingSize().width;
    return (relativeTime / duration) * canvasWidth;
  }

  /**
   * Get the number of pixels per millisecond.
   * Zoom level is taken into account.
   *
   * @returns pixels per millisecond
   */
  getPixelPerMs(): number {
    return (
      (this.getDrawingSize().width /
        (this.timeRange.end - this.timeRange.start)) *
      this.zoomLevel
    );
  }

  /**
   * Get the maximum pan offset in pixels.
   *
   * @returns maximum pan offset in pixels
   */
  private getMaxPanOffset(): number {
    const timeRange = this.dataExtent.getXMax() - this.dataExtent.getXMin();
    const visibleTimeRange = timeRange / this.zoomLevel;
    const endTime = this.dataExtent.getXMin() + visibleTimeRange;
    const pixelPerMs = this.getPixelPerMs();

    return ((this.timeRange.end - endTime) * pixelPerMs) / this.zoomLevel;
  }

  private onMouseMove = (event: MouseEvent) => {
    if (this.data.length == 0) return;
    if (this.lastPointerPosition) {
      this.isPanning = true;
      const dx = event.clientX - this.lastPointerPosition.x;
      const newPanOffset = this.panOffset - dx / this.zoomLevel;

      this.panOffset = Math.max(
        0,
        Math.min(newPanOffset, this.getMaxPanOffset())
      );
      requestAnimationFrame(() => {
        this.controller.draw();
        this.drawIndicators();
      });
      this.lastPointerPosition = { x: event.clientX };
    } else {
      this.isPanning = false;
    }
    requestAnimationFrame(() => {
      const rect = this.getContext("crosshair").canvas.getBoundingClientRect();
      this.pointerMove({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    });
  };

  private adjustZoomLevel(zoomFactor: number) {
    this.zoomLevel *= zoomFactor;
    this.zoomLevel = Math.max(
      Math.min(this.zoomLevel, this.options.maxZoom),
      1
    );
  }

  private onWheel = (event: WheelEvent) => {
    if (this.data.length == 0) return;
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9; // adjust these values as needed

    const offsetX = event.clientX - this.container.getBoundingClientRect().left;

    const oldPoint = this.dataExtent.pixelToPoint(
      offsetX,
      0,
      this.getContext("main").canvas,
      this.zoomLevel,
      this.panOffset
    );

    this.adjustZoomLevel(zoomFactor);

    const newPixelPoint = this.dataExtent.mapToPixel(
      oldPoint.time,
      oldPoint.price,
      this.getContext("main").canvas,
      this.zoomLevel,
      this.panOffset
    );

    const newPanOffset = Math.abs(offsetX - newPixelPoint.x) / this.zoomLevel;

    this.panOffset = Math.max(
      0,
      Math.min(
        this.panOffset + newPanOffset * (event.deltaY < 0 ? 1 : -1),
        this.getMaxPanOffset()
      )
    );

    requestAnimationFrame(() => {
      this.controller.draw();
      this.drawIndicators();
      this.onZoom();
    });
  };

  protected onZoom() {
    this.drawCrosshair();
  }

  private onTouchStart = (event: TouchEvent) => {
    if (this.data.length == 0) return;

    if (event.touches.length === 1) {
      this.lastPointerPosition = {
        x: event.touches[0].clientX,
      };
      this.isTouchCrosshairTimeout = setTimeout(() => {
        this.isTouchCrosshair = !this.isTouchCrosshair;
        this.isTouchCrosshairTimeout = undefined;
        if (this.isTouchCrosshair) {
          const rect =
            this.getContext("crosshair").canvas.getBoundingClientRect();
          this.pointerMove({
            x: event.touches[0].clientX - rect.left,
            y: event.touches[0].clientY - rect.top,
          });
          this.drawCrosshair();
        } else {
          this.lastPointerPosition = undefined;
          this.lastTouchDistance = undefined;
          this.pointerY = -1;
          this.pointerTime = -1;
          this.drawCrosshair();
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
        this.eventListeners.get("touch-click")?.(
          e,
          this.findClosestDataPoint(
            this.visibleExtent.pixelToPoint(
              e.changedTouches[0].clientX - rect.left,
              e.changedTouches[0].clientY - rect.top,
              this.getContext("main").canvas,
              this.zoomLevel,
              this.panOffset
            )
          )!
        );
      }
      clearTimeout(this.isTouchCrosshairTimeout);
      this.isTouchCrosshairTimeout = undefined;
    }
  };

  private onTouchMove = (event: TouchEvent) => {
    if (this.data.length == 0) return;
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
            y: event.touches[0].clientY - rect.top,
          });
          this.drawCrosshair();
        });
        return;
      }
      const dx = event.touches[0].clientX - this.lastPointerPosition.x;
      const newPanOffset = this.panOffset - dx / this.zoomLevel;
      // Limit panOffset to the range [0, canvas.width * (zoomLevel - 1)]
      this.panOffset = Math.max(
        0,
        Math.min(newPanOffset, this.getMaxPanOffset())
      );
      requestAnimationFrame(() => {
        const rect =
          this.getContext("crosshair").canvas.getBoundingClientRect();
        this.controller.draw();
        this.drawIndicators();
        if (!this.isTouchCrosshair) return;
        this.pointerMove({
          x: event.touches[0].clientX - rect.left,
          y: event.touches[0].clientY - rect.top,
        });
      });
      this.lastPointerPosition = {
        x: event.touches[0].clientX,
      };
    } else if (event.touches.length === 2 && this.lastTouchDistance) {
      if (this.isTouchCrosshair) return;
      event.preventDefault();
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const zoomFactor = distance / this.lastTouchDistance; // calculate zoom factor based on change in distance
      const offsetX =
        (event.touches[0].clientX + event.touches[1].clientX) / 2 -
        this.container.offsetWidth / 2;
      const newPanOffset =
        this.panOffset - (offsetX * (zoomFactor - 1)) / this.zoomLevel;
      this.panOffset = Math.max(
        0,
        Math.min(
          newPanOffset,
          this.getDrawingSize().width * (this.zoomLevel - 1)
        )
      );
      this.adjustZoomLevel(zoomFactor);
      requestAnimationFrame(() => {
        this.controller.draw();
        this.drawIndicators();
      });
      this.lastTouchDistance = distance;
    } else {
      const rect = this.getContext("crosshair").canvas.getBoundingClientRect();
      this.pointerMove({
        x: event.touches[0].clientX - rect.left,
        y: event.touches[0].clientY - rect.top,
      });
    }
  };

  private adjustCanvas(
    type: (typeof this.types)[number],
    canvas: HTMLCanvasElement
  ) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    canvas.style.userSelect = "none";
    // @ts-ignore
    canvas.style.webkitTapHighlightColor = "transparent";

    if (type === "y-label") {
      canvas.style.right = "0px";
      canvas.width = this.yLabelWidth * devicePixelRatio;
      canvas.style.width = this.yLabelWidth + "px";
    } else if (
      type === "x-label" ||
      type === "crosshair" ||
      type === "indicator"
    ) {
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
    } else if (type === "crosshair" || type === "indicator") {
      canvas.height = this.container.offsetHeight * devicePixelRatio;
      canvas.style.height = this.container.offsetHeight + "px";
    } else {
      canvas.height =
        this.container.offsetHeight * devicePixelRatio -
        this.xLabelHeight * devicePixelRatio;
      canvas.style.height =
        this.container.offsetHeight - this.xLabelHeight + "px";
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

      if (this.contexts.has(type)) {
        const img = this.contexts
          .get(type)!
          .getImageData(0, 0, canvas.width, canvas.height);

        this.adjustCanvas(type, canvas);
        const ctx = this.getContext(type);
        const devicePixelRatio = window.devicePixelRatio || 1;
        ctx.scale(devicePixelRatio, devicePixelRatio);

        if (this.contexts.has(type)) {
          this.getContext(type).putImageData(img!, 0, 0);
        }
      } else {
        this.adjustCanvas(type, canvas);
        const ctx = this.getContext(type);
        const devicePixelRatio = window.devicePixelRatio || 1;
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
    const devicePixelRatio = window.devicePixelRatio || 1;
    return num * devicePixelRatio;
  }

  /**
   * Convert physical pixels to logical pixels
   *
   * @param num number to convert
   * @returns number in logical pixels
   */
  protected l(num: number) {
    const devicePixelRatio = window.devicePixelRatio || 1;
    return num / devicePixelRatio;
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
    const width = this.getContext(type).canvas.width / window.devicePixelRatio;
    const height =
      this.getContext(type).canvas.height / window.devicePixelRatio;
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

  /**
   * Get the currently visible time range.
   * This is the time range that is visible on the screen.
   *
   * @returns the currently visible time range
   */
  public getVisibleTimeRange(): TimeRange {
    const pixelPerMs = this.getPixelPerMs() / this.zoomLevel;

    const timeRange = this.dataExtent.getXMax() - this.dataExtent.getXMin();
    const visibleTimeRange = timeRange / this.zoomLevel;
    const startTime = this.dataExtent.getXMin() + this.panOffset / pixelPerMs;
    const endTime = startTime + visibleTimeRange;
    return { start: startTime, end: endTime };
  }

  /**
   * Draws/Redraws the whole chart with the given data.
   * If you only have one sequentially new point, use drawNewChartPoint
   * instead for better performance.
   *
   * @param data chart data to draw
   */
  public draw(data: ChartData[]) {
    this.dataExtent = this.controller.createDataExtent(
      this.data,
      this.timeRange
    );
    if (data.length == 0) return;
    this.originalData = data;
    this.data = this.mapDataToStepSize(data, this.options.stepSize);

    this.xLabelDates = [];

    for (const d of this.data) {
      if (d.time < this.timeRange.start) continue;
      this.xLabelDates.push(new Date(d.time));
    }

    requestAnimationFrame(() => this.redraw());
  }

  /**
   * Draws the next point to the chart.
   * If you have only one new point, use this
   * for better performance.
   *
   * @param data chart data to draw
   */
  public drawNextPoint(data: ChartData) {
    this.originalData.push(data);
    this.transformNewData(data);

    requestAnimationFrame(() => this.redraw());
  }

  /**
   * Adds and draws a new indicator.
   *
   * @param indicator indicator to draw
   */
  public addIndicator(indicator: Indicator<any, any>) {
    indicator.setChart(this);
    this.indicators.push(indicator);
    requestAnimationFrame(() => this.drawIndicators());
  }

  /**
   * Removes an indicator from the chart and redraws the indicators
   * to reflect the changes.
   *
   * @param indicator indicator to remove
   */
  public removeIndicator(indicator: string): void;
  public removeIndicator(indicator: Indicator<any, any>): void;
  public removeIndicator(indicator: any): void {
    if (typeof indicator === "string") {
      this.indicators = this.indicators.filter(
        (i) => Object.getPrototypeOf(i).ID !== indicator
      );
    } else {
      this.indicators = this.indicators.filter((i) => i !== indicator);
    }
    requestAnimationFrame(() => this.drawIndicators());
  }

  /**
   * Removes all indicators from the chart that has the same type
   * as the provided new indicator, then adds the new indicator to the top.
   * This is useful if user wants to change the options of the indicator.
   *
   * @param indicator new indicator
   */
  public replaceIndicator(indicator: Indicator<any, any>) {
    indicator.setChart(this);
    this.indicators = this.indicators.filter((i) => {
      return (
        Object.getPrototypeOf(i).ID !== Object.getPrototypeOf(indicator).ID
      );
    });
    this.indicators.push(indicator);
    requestAnimationFrame(() => this.drawIndicators());
  }

  /**
   * Removes the old indicator and adds the new indicator to the top.
   * Will compare by reference.
   * This is useful if user wants to change the options of the indicator.
   *
   * @param oldIndicator indicator reference to remove
   * @param newIndicator new indicator to add
   */
  public replaceIndicatorByInstance(
    oldIndicator: Indicator<any, any>,
    newIndicator: Indicator<any, any>
  ) {
    newIndicator.setChart(this);
    this.indicators = this.indicators.filter((i) => {
      return i !== oldIndicator;
    });
    this.indicators.push(newIndicator);
    requestAnimationFrame(() => this.drawIndicators());
  }

  protected pointerMove(e: { x: number; y: number }) {
    if (this.isTouchCapable && !this.isTouchCrosshair) return;
    const rawPoint = this.visibleExtent.pixelToPoint(
      e.x,
      e.y,
      this.getContext("main").canvas,
      this.zoomLevel,
      this.panOffset
    );
    const closestDataPoint = this.findClosestDataPoint(rawPoint);
    if (!closestDataPoint) return;
    this.crosshairDataPoint = closestDataPoint;
    this.pointerTime = closestDataPoint.time;
    this.pointerY = Math.min(e.y, this.getDrawingSize().height);
    this.drawCrosshair();
  }

  private drawIndicators() {
    if (this.data.length == 0) return;
    const ctx = this.getContext("indicator");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (const indicator of this.indicators) {
      indicator.draw();
    }
  }

  private drawCrosshair(): void {
    const ctx = this.getContext("crosshair");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (this.pointerTime === -1) return;
    if (this.pointerY === -1) return;
    if (this.isTouchCapable && !this.isTouchCrosshair) return;

    if (this.pointerY >= this.getDrawingSize().height) {
      this.getContext("crosshair").clearRect(
        0,
        0,
        this.getFullSize().width,
        this.getFullSize().height
      );
      return;
    }

    const xOffset = this.controller.getXLabelOffset();

    const { x } = this.visibleExtent.mapToPixel(
      this.pointerTime + xOffset,
      0,
      this.getContext("main").canvas,
      this.zoomLevel,
      this.panOffset
    );
    ctx.strokeStyle = this.options.theme.crosshair.color;
    ctx.lineWidth = this.options.theme.crosshair.width;
    ctx.setLineDash(this.options.theme.crosshair.lineDash);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, this.getDrawingSize().height);
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
      this.getDrawingSize().height,
      rectWidth,
      textPadding * 2 + 12
    );

    const price = this.visibleExtent.pixelToPoint(
      0,
      this.pointerY,
      this.getContext("main").canvas,
      this.zoomLevel,
      this.panOffset
    ).price;
    const decimals = this.estimatePriceLabelDecimalPlaces(30);
    const priceText = this.options.formatter.formatTooltipPrice(
      price,
      decimals
    );
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
    ctx.fillText(text, textX, this.getDrawingSize().height + textPadding * 2);
    ctx.fillText(
      priceText,
      priceTextX,
      Math.max(this.pointerY + textPadding / 2, textPadding + 6)
    );

    ctx.font = `${this.options.theme.crosshair.infoLine.fontSize}px ${this.options.theme.crosshair.infoLine.font}, monospace`;

    const p = this.crosshairDataPoint!;

    const ohlc = [p.open, p.high, p.low, p.close];
    const labels =
      this.options.theme.crosshair.infoLine.labels[this.options.locale] ||
      this.options.theme.crosshair.infoLine.labels["*"];
    const visibleLabels = this.controller.getEffectiveCrosshairValues();

    let ohlcTextX = 10;
    const spacing = 10;

    for (let i = 0; i < ohlc.length; i++) {
      if (!visibleLabels[i]) continue;
      const price = ohlc[i];
      if (price == undefined) continue;
      const ohlcText = this.options.formatter.formatTooltipPrice(
        price,
        decimals
      );

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
  }

  /**
   * Properly dispose the chart controller.
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
      this.visibleExtent.getYMax() - this.visibleExtent.getYMin();
    const maxLabels = Math.floor(this.getDrawingSize().height / labelSpacing);
    const stepSize = priceRange / maxLabels;

    // Estimate decimal places based on step size
    if (stepSize < 0.0001) {
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
    if (data.length === 0) return data;
    data = data.map((d) => {
      return d.time % stepSize === 0
        ? d
        : { ...d, time: d.time - (d.time % stepSize) };
    });

    // merge data points that has the same time
    const mergedData: ChartData[] = [];
    let lastData: ChartData | undefined;

    for (const d of data) {
      if (!lastData) {
        lastData = d;
        continue;
      }

      if (d.time === lastData.time) {
        // set last data but do not override open!
        // setup high, low and close
        lastData = {
          ...lastData,
          open: lastData.open!,
          high: Math.max(lastData.high!, d.high!),
          low: Math.min(lastData.low!, d.low!),
          close: d.close!,
        };
      } else {
        mergedData.push(lastData);
        lastData = d;
      }
    }

    mergedData.push(lastData!);

    return mergedData;
  }

  protected transformNewData(data: ChartData) {
    const d =
      data.time % this.options.stepSize === 0
        ? data
        : { ...data, time: data.time - (data.time % this.options.stepSize) };

    // If there isn't any data yet, just add it
    if (this.data.length === 0) {
      this.data.push(d);
      this.dataExtent.addDataPoint(d);
      return;
    }

    const lastData = this.data[this.data.length - 1];

    // If the data is the same as the last data, update the last data
    if (d.time === lastData.time) {
      const td = {
        ...lastData,
        open: lastData.open!,
        high: Math.max(lastData.high!, d.high!),
        low: Math.min(lastData.low!, d.low!),
        close: d.close!,
      };
      this.data[this.data.length - 1] = td;
      this.dataExtent.addDataPoint(td);
    } else {
      this.data.push(d);
      this.dataExtent.addDataPoint(d);
      this.xLabelDates.push(new Date(d.time));
      return d;
    }
  }

  protected roundToNiceNumber(number: number) {
    const orderOfMagnitude = Math.pow(10, Math.floor(Math.log10(number)));
    const fraction = number / orderOfMagnitude;

    let niceFraction;
    if (fraction < 1.5) {
      niceFraction = 1;
    } else if (fraction < 3) {
      niceFraction = 2;
    } else if (fraction < 7) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }

    return niceFraction * orderOfMagnitude;
  }

  private calculateYAxisLabels(labelSpacing: number) {
    const fontSize = this.options.theme.yAxis.fontSize;
    const textHeight = fontSize * 1.2; // Estimated height of text
    const canvasHeight = this.getLogicalCanvas("y-label").height;

    let range = this.visibleExtent.getYMax() - this.visibleExtent.getYMin();
    range = Math.max(range, 0.0001); // Ensure a minimum range to avoid division by zero

    const maxPossibleLabels = Math.floor(
      canvasHeight / (textHeight + labelSpacing)
    );
    const stepSize = this.calculateStepSize(range, maxPossibleLabels);

    const firstLabel =
      Math.ceil(this.visibleExtent.getYMin() / stepSize) * stepSize;
    const labels: AxisLabel[] = [];

    for (
      let value = firstLabel;
      value <= this.visibleExtent.getYMax();
      value += stepSize
    ) {
      const position =
        canvasHeight -
        ((value - this.visibleExtent.getYMin()) / range) * canvasHeight;
      labels.push({ value: parseFloat(value.toFixed(10)), position });
    }

    return labels;
  }

  private calculateStepSize(range: number, maxLabels: number) {
    // Determine the step size based on the range and maximum number of labels
    const rawStep = range / maxLabels;

    // Adjust the step size based on the magnitude of the range
    let magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    if (magnitude === 0) {
      magnitude = 0.1; // Adjust for very small ranges
    }

    let normalizedStep = rawStep / magnitude;
    let stepSize;

    if (normalizedStep < 1.5) {
      stepSize = 1 * magnitude;
    } else if (normalizedStep < 3) {
      stepSize = 2 * magnitude;
    } else if (normalizedStep < 7.5) {
      stepSize = 5 * magnitude;
    } else {
      stepSize = 10 * magnitude;
    }

    // Ensure that step size is not smaller than the smallest significant digit
    const decimalPlaces = Math.max(-Math.floor(Math.log10(range)), 0);
    return parseFloat(stepSize.toFixed(decimalPlaces));
  }

  drawYAxis(): void {
    const yAxisValues = this.calculateYAxisLabels(30);

    const ctx = this.getContext("y-label");
    ctx.fillStyle = this.options.theme.yAxis.backgroundColor;
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fill();

    ctx.fillStyle = this.options.theme.yAxis.color;
    ctx.font =
      ctx.font = `${this.options.theme.yAxis.fontSize}px ${this.options.theme.xAxis.font}, monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i < yAxisValues.length; i++) {
      const value = yAxisValues[i];
      const y = value.position;
      if (y - this.options.theme.yAxis.fontSize < 0) continue;
      if (
        y + this.options.theme.yAxis.fontSize >
        this.getLogicalCanvas("y-label").height
      )
        continue;
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
      mainCtx.lineTo(mainCtx.canvas.width, y);
      mainCtx.stroke();
    }
  }

  drawXAxis(): void {
    const labels = this.processXLabels(); // Assumed to return labels with date, displayLabel, and priority
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
    const padding = this.p(20);

    let drawnLabels: { start: number; end: number }[] = [];

    labels.sort((a, b) => b.priority - a.priority);

    labels.forEach((label) => {
      const { x } = this.dataExtent.mapToPixel(
        label.date.getTime() + this.controller.getXLabelOffset(),
        0,
        { width: canvasWidth, height: 0 } as HTMLCanvasElement,
        this.zoomLevel,
        this.panOffset
      );

      const textWidth = ctx.measureText(label.displayLabel).width;
      const labelPos = { start: x - textWidth / 2, end: x + textWidth / 2 };

      // Check for overlap with already drawn labels
      const overlaps = drawnLabels.some(
        (drawnLabel) =>
          labelPos.start < drawnLabel.end + padding &&
          labelPos.end > drawnLabel.start - padding
      );

      if (!overlaps && labelPos.end < canvasWidth) {
        if (labelPos.start >= 0) {
          ctx.fillText(label.displayLabel, labelPos.start, sizes.height - 15);

          // Draw grid line
          mainCtx.lineWidth = this.options.theme.grid.width;
          mainCtx.strokeStyle = this.options.theme.grid.color;
          mainCtx.beginPath();
          mainCtx.moveTo(x, 0);
          mainCtx.lineTo(x, mainCtx.canvas.height);
          mainCtx.stroke();
        }

        drawnLabels.push(labelPos);
      }
    });
  }

  private lastVisibleDataPoints: ChartData[] = [];

  recalculateVisibleExtent() {
    const visibleTimeRange = this.getVisibleTimeRange();

    let firstPointIndex = 0;
    let lastPointIndex = this.data.length - 1;

    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].time >= visibleTimeRange.start - this.options.stepSize) {
        firstPointIndex = i;
        break;
      }
    }

    for (let i = this.data.length - 1; i >= 0; i--) {
      if (this.data[i].time <= visibleTimeRange.end) {
        lastPointIndex = i;
        break;
      }
    }

    const visibleDataPoints = this.data.slice(
      firstPointIndex,
      Math.min(lastPointIndex + 1 + 1, this.data.length)
    );
    // Do not recalc xMin and xMax to preserve x positions
    // but we need to adjust yMin and yMax to the visible data points
    this.visibleExtent.recalculate(visibleDataPoints, this.timeRange);

    this.lastVisibleDataPoints = visibleDataPoints;
    return visibleDataPoints;
  }

  getLastVisibleDataPoints() {
    return this.lastVisibleDataPoints;
  }
}
