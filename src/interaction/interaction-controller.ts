import type { ChartCrosshairState } from "./crosshair";
import type { ChartPointerEvent } from "../plugin/chart-plugin";
import { bindEvent } from "../utils/dom";
import type { Pane } from "../panes/pane";
import type { ChartData } from "../chart/types";

type CrosshairSource = "mouse" | "touch" | "programmatic";

interface CrosshairModel {
  state: ChartCrosshairState;
  source: CrosshairSource;
}

interface InteractionHost {
  hasData(): boolean;
  createPointerEvent(
    type: ChartPointerEvent["type"],
    x: number,
    y: number,
    source?: PointerEvent | MouseEvent
  ): ChartPointerEvent | undefined;
  dispatchPointer(event: ChartPointerEvent): boolean;
  resolveDataPoint(
    x: number,
    y: number,
    scale: "data" | "visible"
  ): ChartData | undefined;
  resolveCrosshair(x: number, y: number): ChartCrosshairState | undefined;
  getPaneById(paneId: number): Pane;
  panByPixels(dx: number): void;
  zoomAtPixel(zoomFactor: number, pixel: number): void;
  clearCrosshair(): void;
  crosshairChanged(state: ChartCrosshairState): void;
  click(event: PointerEvent, point: ChartData): void;
  touchClick(event: TouchEvent, point: ChartData): void;
}

export class InteractionController {
  private crosshair?: CrosshairModel;
  private isPanning = false;
  private pointerGestureConsumed = false;
  private touchGestureConsumed = false;
  private lastTouchDistance?: number;
  private lastPointerPosition?: { x: number };
  private isTouchCrosshair = false;
  private touchCrosshairTimeout?: ReturnType<typeof setTimeout>;
  private activePointerId?: number;
  private canvasRect?: DOMRect;
  private readonly disposers: Array<() => void> = [];
  private disposed = false;

  constructor(
    private readonly host: InteractionHost,
    private readonly canvas: HTMLCanvasElement
  ) {
    this.disposers.push(
      bindEvent(canvas, "pointerdown", this.onPointerDown),
      bindEvent(canvas, "pointermove", this.onPointerMove),
      bindEvent(canvas, "pointerup", this.onPointerUp),
      bindEvent(canvas, "pointercancel", this.onPointerCancel),
      bindEvent(canvas, "lostpointercapture", this.onLostPointerCapture),
      bindEvent(canvas, "mousemove", this.onMouseMove),
      bindEvent(canvas, "wheel", this.onWheel, { passive: false }),
      bindEvent(canvas, "touchstart", this.onTouchStart, { passive: false }),
      bindEvent(canvas, "touchend", this.onTouchEnd, { passive: false }),
      bindEvent(canvas, "touchmove", this.onTouchMove, { passive: false }),
      bindEvent(canvas, "contextmenu", (event) => event.preventDefault()),
      bindEvent(canvas, "pointerleave", this.onPointerLeave),
      bindEvent(window, "resize", this.invalidateBounds),
      bindEvent(window, "scroll", this.invalidateBounds, {
        capture: true,
        passive: true
      })
    );
  }

  invalidateBounds = (): void => {
    this.canvasRect = undefined;
  };

  getCrosshairState(): ChartCrosshairState | undefined {
    return this.crosshair?.state;
  }

  getCrosshairTime(): number | undefined {
    return this.crosshair?.state.time;
  }

  setProgrammaticCrosshair(state: ChartCrosshairState): void {
    this.crosshair = { state, source: "programmatic" };
  }

  clearCrosshair(): boolean {
    const hadCrosshair = this.crosshair !== undefined;
    this.crosshair = undefined;
    return hadCrosshair;
  }

  shouldDrawCrosshair(): boolean {
    return (
      this.crosshair !== undefined &&
      (this.crosshair.source !== "touch" || this.isTouchCrosshair)
    );
  }

  replacePane(removed: Pane | undefined, replacement: Pane): void {
    if (!removed || this.crosshair?.state.paneId !== removed.getId()) return;
    const region = replacement.getRegion();
    this.crosshair = {
      ...this.crosshair,
      state: {
        ...this.crosshair.state,
        paneId: replacement.getId(),
        price: replacement.getPriceScale().unproject(
          replacement.getRelativeY(this.crosshair.state.y),
          { canvas: { width: region.width, height: region.height } }
        )
      }
    };
  }

  reset(): void {
    this.crosshair = undefined;
    this.resetGestureState();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resetGestureState();
    for (const dispose of this.disposers.splice(0)) dispose();
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (event.pointerType === "touch" && this.activePointerId !== undefined) {
      this.cancelActiveTouchGesture(event);
      return;
    }
    this.activePointerId = event.pointerId;
    this.canvas.setPointerCapture?.(event.pointerId);
    const { x, y } = this.getCanvasPoint(event.clientX, event.clientY);
    const pointerEvent = this.host.createPointerEvent("down", x, y, event);
    this.pointerGestureConsumed = pointerEvent
      ? this.host.dispatchPointer(pointerEvent)
      : false;
    this.touchGestureConsumed =
      event.pointerType === "touch" && this.pointerGestureConsumed;
    if (this.touchGestureConsumed) event.preventDefault();
    this.lastPointerPosition = this.pointerGestureConsumed
      ? undefined
      : { x: event.clientX };
  };

  private onPointerMove = (event: PointerEvent) => {
    if (
      event.pointerType !== "touch" ||
      event.pointerId !== this.activePointerId ||
      !this.pointerGestureConsumed
    ) {
      return;
    }

    event.preventDefault();
    const { x, y } = this.getCanvasPoint(event.clientX, event.clientY);
    const pointerEvent = this.host.createPointerEvent("move", x, y, event);
    if (pointerEvent) this.host.dispatchPointer(pointerEvent);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0 || event.pointerId !== this.activePointerId) {
      return;
    }
    this.finishPointerGesture(event, event.pointerType !== "touch");
  };

  private onPointerCancel = (event: PointerEvent) => {
    if (this.activePointerId !== event.pointerId) {
      return;
    }
    this.finishPointerGesture(event, false, event.pointerType === "touch");
  };

  private onLostPointerCapture = (event: PointerEvent) => {
    if (this.activePointerId !== event.pointerId) return;
    this.finishPointerGesture(event, false, event.pointerType === "touch");
  };

  private finishPointerGesture(
    event: PointerEvent,
    emitClick: boolean,
    cancelled = false
  ) {
    const { x, y } = this.getCanvasPoint(event.clientX, event.clientY);
    const resolvedPointerEvent = this.host.createPointerEvent(
      "up",
      x,
      y,
      event
    );
    const pointerEvent =
      resolvedPointerEvent && cancelled
        ? { ...resolvedPointerEvent, cancelled: true }
        : resolvedPointerEvent;
    const consumed = pointerEvent
      ? this.host.dispatchPointer(pointerEvent)
      : false;

    if (
      emitClick &&
      !this.isPanning &&
      !this.pointerGestureConsumed &&
      !consumed
    ) {
      const point = this.host.resolveDataPoint(x, y, "data");
      if (point) this.host.click(event, point);
    }
    this.activePointerId = undefined;
    this.lastPointerPosition = undefined;
    this.pointerGestureConsumed = false;
    this.isPanning = false;
  }

  private cancelActiveTouchGesture(event: PointerEvent): void {
    const pointerId = this.activePointerId;
    if (this.pointerGestureConsumed) {
      this.finishPointerGesture(event, false, true);
    } else {
      this.activePointerId = undefined;
      this.lastPointerPosition = undefined;
      this.isPanning = false;
    }
    this.touchGestureConsumed = false;
    if (pointerId !== undefined && this.canvas.hasPointerCapture?.(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
  }

  private onMouseMove = (event: MouseEvent) => {
    if (!this.hasData()) return;
    if (this.lastPointerPosition) {
      this.isPanning = true;
      this.host.panByPixels(event.clientX - this.lastPointerPosition.x);
      this.lastPointerPosition = { x: event.clientX };
    } else {
      this.isPanning = false;
    }
    const { x, y } = this.getCanvasPoint(event.clientX, event.clientY);
    this.moveCrosshair(x, y, "mouse");
  };

  private onWheel = (event: WheelEvent) => {
    if (!this.hasData()) return;
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const offsetX = this.getCanvasPoint(event.clientX, event.clientY).x;
    this.host.zoomAtPixel(zoomFactor, offsetX);
  };

  private onTouchStart = (event: TouchEvent) => {
    if (!this.hasData()) return;
    if (this.touchGestureConsumed) {
      event.preventDefault();
      return;
    }
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.lastPointerPosition = { x: touch.clientX };
      const point = { x: touch.clientX, y: touch.clientY };
      this.touchCrosshairTimeout = setTimeout(() => {
        this.touchCrosshairTimeout = undefined;
        this.isTouchCrosshair = !this.isTouchCrosshair;
        if (this.isTouchCrosshair) {
          const canvasPoint = this.getCanvasPoint(point.x, point.y);
          this.moveCrosshair(canvasPoint.x, canvasPoint.y, "touch");
        } else {
          this.lastPointerPosition = undefined;
          this.lastTouchDistance = undefined;
          this.host.clearCrosshair();
        }
      }, 500);
    } else if (event.touches.length === 2) {
      this.lastTouchDistance = touchDistance(event.touches);
    }
  };

  private onTouchEnd = (event: TouchEvent) => {
    if (this.touchGestureConsumed) {
      event.preventDefault();
      this.touchGestureConsumed = false;
      this.cancelTouchCrosshairTimeout();
      return;
    }
    if (!this.isTouchCrosshair) {
      this.lastPointerPosition = undefined;
      this.lastTouchDistance = undefined;
    }
    if (this.touchCrosshairTimeout === undefined) return;

    if (this.isTouchCrosshair && event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      const { x, y } = this.getCanvasPoint(touch.clientX, touch.clientY);
      const point = this.host.resolveDataPoint(x, y, "visible");
      if (point) this.host.touchClick(event, point);
    }
    this.cancelTouchCrosshairTimeout();
  };

  private onTouchMove = (event: TouchEvent) => {
    if (!this.hasData()) return;
    if (this.touchGestureConsumed) {
      event.preventDefault();
      return;
    }
    this.cancelTouchCrosshairTimeout();

    if (event.touches.length === 1 && this.lastPointerPosition) {
      const touch = event.touches[0];
      if (this.isTouchCrosshair) {
        requestAnimationFrame(() => {
          if (this.disposed) return;
          const { x, y } = this.getCanvasPoint(touch.clientX, touch.clientY);
          this.moveCrosshair(x, y, "touch");
        });
        return;
      }
      this.host.panByPixels(touch.clientX - this.lastPointerPosition.x);
      this.lastPointerPosition = { x: touch.clientX };
    } else if (event.touches.length === 2 && this.lastTouchDistance) {
      if (this.isTouchCrosshair) return;
      event.preventDefault();
      const distance = touchDistance(event.touches);
      const rect = this.getCanvasRect();
      const offsetX =
        (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
      this.host.zoomAtPixel(distance / this.lastTouchDistance, offsetX);
      this.lastTouchDistance = distance;
    } else if (event.touches.length > 0) {
      const touch = event.touches[0];
      const { x, y } = this.getCanvasPoint(touch.clientX, touch.clientY);
      this.moveCrosshair(x, y, "touch");
    }
  };

  private onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (this.activePointerId === event.pointerId) return;
    this.lastPointerPosition = undefined;
    this.lastTouchDistance = undefined;
    this.isPanning = false;
    requestAnimationFrame(() => {
      if (!this.disposed) this.host.clearCrosshair();
    });
  };

  private moveCrosshair(x: number, y: number, source: "mouse" | "touch"): void {
    const state = this.host.resolveCrosshair(x, y);
    if (!state) return;
    this.crosshair = { state, source };
    const pointerEvent: ChartPointerEvent = {
      type: "move",
      x,
      y: state.y,
      time: state.time,
      pane: this.host.getPaneById(state.paneId),
      dataPoint: state.dataPoint
    };
    this.host.dispatchPointer(pointerEvent);
    this.host.crosshairChanged(state);
  }

  private hasData(): boolean {
    return this.host.hasData();
  }

  private getCanvasPoint(clientX: number, clientY: number) {
    const rect = this.getCanvasRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private getCanvasRect(): DOMRect {
    return (this.canvasRect ??= this.canvas.getBoundingClientRect());
  }

  private cancelTouchCrosshairTimeout(): void {
    if (this.touchCrosshairTimeout === undefined) return;
    clearTimeout(this.touchCrosshairTimeout);
    this.touchCrosshairTimeout = undefined;
  }

  private resetGestureState(): void {
    this.cancelTouchCrosshairTimeout();
    this.isPanning = false;
    this.pointerGestureConsumed = false;
    this.touchGestureConsumed = false;
    this.lastTouchDistance = undefined;
    this.lastPointerPosition = undefined;
    this.isTouchCrosshair = false;
    const pointerId = this.activePointerId;
    this.activePointerId = undefined;
    if (pointerId !== undefined && this.canvas.hasPointerCapture?.(pointerId)) {
      this.canvas.releasePointerCapture(pointerId);
    }
  }
}

function touchDistance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
