import { DataExtent } from "./data-extent";
import { ChartData, TimeRange } from "./types";

export type DeepConcrete<T> = T extends object
  ? { [P in keyof T]-?: DeepConcrete<T[P]> }
  : T;

export abstract class ChartController<TOptions> {
  private readonly types = ["main", "crosshair", "x-label", "y-label"] as const;
  protected container: HTMLElement;
  protected canvases: Map<string, HTMLCanvasElement> = new Map();
  protected contexts: Map<string, CanvasRenderingContext2D> = new Map();
  protected isPanning: boolean = false;
  protected data: ChartData[] = [];
  protected options: DeepConcrete<TOptions>;
  protected zoomLevel = 1;
  protected panOffset = 0;
  protected timeRange: TimeRange;
  protected dataExtent!: DataExtent;

  protected yLabelWidth = 80;
  protected xLabelHeight = 30;

  private lastTouchDistance?: number;
  private lastPointerPosition?: { x: number };
  private resizeObserver: ResizeObserver;

  protected abstract createDataExtent(
    data: ChartData[],
    timeRange: TimeRange
  ): DataExtent;

  constructor(
    container: HTMLElement,
    timeRange: TimeRange,
    options: DeepConcrete<TOptions>
  ) {
    this.options = options;
    this.container = container;
    this.timeRange = timeRange;
    // Init and scale canveses
    this.types.forEach((type) => this.getCanvas(type));
    const topCanvas = this.getCanvas("crosshair");
    topCanvas.addEventListener("mousedown", this.onMouseDown);
    topCanvas.addEventListener("mouseup", this.onMouseUp);
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
    topCanvas.addEventListener("pointerleave", () => {
      this.lastPointerPosition = undefined;
      this.lastTouchDistance = undefined;
      this.isPanning = false;
      requestAnimationFrame(() => {
        this.getContext("crosshair").clearRect(
          0,
          0,
          topCanvas.width,
          topCanvas.height
        );
      });
    });
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvases();
      if (this.data.length > 0) {
        requestAnimationFrame(() => this.drawChart());
      }
    });
    this.resizeObserver.observe(this.container);
  }

  public updateTimeRange(timeRange: TimeRange, data: ChartData[]) {
    this.data = data;
    this.timeRange = timeRange;
    this.zoomLevel = 1;
    this.panOffset = 0;
    if (this.data.length > 0) {
      requestAnimationFrame(() => this.drawChart());
    }
  }

  private onMouseDown = (event: MouseEvent) => {
    this.lastPointerPosition = { x: event.clientX };
  };

  private onMouseUp = () => {
    this.lastPointerPosition = undefined;
  };

  protected timeToPixel(time: number): number {
    const duration = this.dataExtent.getXMax() - this.dataExtent.getXMin();
    const relativeTime = time - this.timeRange.start;
    const canvasWidth = this.getLogicalCanvas("main").width;
    return (relativeTime / duration) * canvasWidth;
  }

  private getMaxPanOffset(): number {
    const timeRange = this.dataExtent.getXMax() - this.dataExtent.getXMin();
    const visibleTimeRange = timeRange / this.zoomLevel;
    const endTime = this.dataExtent.getXMin() + visibleTimeRange;

    const pixelPerSecond =
      (this.getLogicalCanvas("main").width /
        (this.timeRange.end - this.timeRange.start)) *
      this.zoomLevel;

    return ((this.timeRange.end - endTime) * pixelPerSecond) / this.zoomLevel;
  }

  private onMouseMove = (event: MouseEvent) => {
    if (this.data.length == 0) return;
    if (this.lastPointerPosition) {
      const dx = event.clientX - this.lastPointerPosition.x;
      const newPanOffset = this.panOffset - dx / this.zoomLevel;

      this.panOffset = Math.max(
        0,
        Math.min(newPanOffset, this.getMaxPanOffset())
      );
      requestAnimationFrame(() => this.drawChart());
      this.lastPointerPosition = { x: event.clientX };
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
      Math.min(this.zoomLevel, this.getMaxZoomLevel()),
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
      this.drawChart();
      this.onZoom();
    });
  };

  protected onZoom() {}

  private onTouchStart = (event: TouchEvent) => {
    if (event.touches.length === 1) {
      this.lastPointerPosition = {
        x: event.touches[0].clientX,
      };
    } else if (event.touches.length === 2) {
      const dx = event.touches[0].clientX - event.touches[1].clientX;
      const dy = event.touches[0].clientY - event.touches[1].clientY;
      this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  };

  private onTouchEnd = () => {
    this.lastPointerPosition = undefined;
    this.lastTouchDistance = undefined;
  };

  private onTouchMove = (event: TouchEvent) => {
    if (this.data.length == 0) return;
    if (event.touches.length === 1 && this.lastPointerPosition) {
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
        this.drawChart();
        this.pointerMove({
          x: event.touches[0].clientX - rect.left,
          y: event.touches[0].clientY - rect.top,
        });
      });
      this.lastPointerPosition = {
        x: event.touches[0].clientX,
      };
    } else if (event.touches.length === 2 && this.lastTouchDistance) {
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
      // Limit panOffset to the range [0, this.getCanvas("main").width * (zoomLevel - 1)]
      this.panOffset = Math.max(
        0,
        Math.min(
          newPanOffset,
          this.getLogicalCanvas("main").width * (this.zoomLevel - 1)
        )
      );
      this.adjustZoomLevel(zoomFactor);
      requestAnimationFrame(() => this.drawChart());
      this.lastTouchDistance = distance;
    } else {
      this.pointerMove({
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      });
    }
  };

  private adjustCanvas(
    type: (typeof this.types)[number],
    canvas: HTMLCanvasElement
  ) {
    const devicePixelRatio = window.devicePixelRatio || 1;

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
      canvas.height =
        this.container.offsetHeight * devicePixelRatio -
        this.xLabelHeight * devicePixelRatio;
      canvas.style.height =
        this.container.offsetHeight - this.xLabelHeight + "px";
    }
  }

  public getCanvas(type: (typeof this.types)[number]): HTMLCanvasElement {
    const canvas: HTMLCanvasElement =
      this.canvases.get(type) || document.createElement("canvas");

    if (!this.canvases.has(type)) {
      canvas.style.position = "absolute";
      canvas.style.zIndex = type === "crosshair" ? "2" : "1";
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

  protected getContext(
    type: (typeof this.types)[number]
  ): CanvasRenderingContext2D {
    if (!this.contexts.has(type)) {
      const ctx = this.getCanvas(type).getContext("2d")!;
      this.contexts.set(type, ctx);
    }

    return this.contexts.get(type)!;
  }

  protected getLogicalCanvas(type: (typeof this.types)[number]) {
    const width = this.getContext(type).canvas.width / window.devicePixelRatio;
    const height =
      this.getContext(type).canvas.height / window.devicePixelRatio;
    return { width, height };
  }

  protected getVisibleTimeRange(): TimeRange {
    const size = this.getLogicalCanvas("main");
    const pixelPerSecond =
      size.width / (this.timeRange.end - this.timeRange.start);

    const timeRange = this.dataExtent.getXMax() - this.dataExtent.getXMin();
    const visibleTimeRange = timeRange / this.zoomLevel;
    const startTime =
      this.dataExtent.getXMin() + this.panOffset / pixelPerSecond;
    const endTime = startTime + visibleTimeRange;
    return { start: startTime, end: endTime };
  }

  public draw(data: ChartData[]) {
    this.dataExtent = this.createDataExtent(this.data, this.timeRange);
    if (data.length == 0) return;
    this.data = this.transformData(data);
    requestAnimationFrame(() => this.drawChart());
  }

  public drawNextPoint(data: ChartData) {
    const tdata = this.transformNewData(data);
    this.data.push(tdata);
    const changed = this.dataExtent.addDataPoint(tdata);
    requestAnimationFrame(() => {
      if (changed) this.drawChart();
      else this.drawNewChartPoint(tdata);
    });
  }

  protected abstract transformData(data: ChartData[]): ChartData[];
  protected abstract transformNewData(data: ChartData): ChartData;

  protected abstract drawChart(): void;
  protected abstract getMaxZoomLevel(): number;

  protected abstract drawNewChartPoint(data: ChartData): void;

  protected abstract pointerMove(e: { x: number; y: number }): any;

  public dispose() {
    const mainCanvas = this.getCanvas("main");
    mainCanvas.removeEventListener("mousedown", this.onMouseDown);
    mainCanvas.removeEventListener("mouseup", this.onMouseUp);
    mainCanvas.removeEventListener("mousemove", this.onMouseMove);
    mainCanvas.removeEventListener("touchstart", this.onTouchStart);
    mainCanvas.removeEventListener("touchend", this.onTouchEnd);
    mainCanvas.removeEventListener("touchmove", this.onTouchMove);
    this.resizeObserver.unobserve(this.container);
    this.resizeObserver.disconnect();
    this.canvases.forEach((canvas) => canvas.remove());
    this.canvases.clear();
  }

  protected estimatePriceLabelDecimalPlaces(
    priceRange: number,
    canvasHeight: number,
    labelSpacing: number
  ) {
    const maxLabels = Math.floor(canvasHeight / labelSpacing);
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
}
