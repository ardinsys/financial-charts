import type { ChartModel } from "../chart/chart-model";
import type { ChartData } from "../chart/types";
import type { Pane } from "../panes/pane";
import type { PaneLayout } from "../panes/pane-layout";
import type { ChartPointerEvent } from "../plugin/chart-plugin";
import type { BarAlignment } from "../scales/time-scale";
import type { ChartCrosshairOptions, ChartCrosshairState } from "./crosshair";

interface CrosshairResolverHost {
  normalizeTime(point: ChartData): number;
  getMainCanvas(): HTMLCanvasElement;
  getDrawingWidth(): number;
  getPlotHeight(): number;
  getTimeAnchorAlignment(): BarAlignment;
}

/** Resolves pointer and programmatic crosshairs against chart coordinates. */
export class CrosshairResolver {
  constructor(
    private readonly model: ChartModel,
    private readonly paneLayout: PaneLayout,
    private readonly host: CrosshairResolverHost
  ) {}

  createPointerEvent(
    type: ChartPointerEvent["type"],
    x: number,
    y: number,
    source?: PointerEvent | MouseEvent
  ): ChartPointerEvent | undefined {
    const state = this.resolvePointer(x, y);
    if (!state) return undefined;

    return {
      type,
      x,
      y: state.y,
      time: state.time,
      pane: this.paneLayout.getPaneById(state.paneId),
      dataPoint: state.dataPoint,
      button: source?.button,
      buttons: source?.buttons
    };
  }

  resolveDataPoint(
    x: number,
    y: number,
    scale: "data" | "visible"
  ): ChartData | undefined {
    if (!this.model.hasData()) return undefined;
    const rawPoint = (
      scale === "data"
        ? this.model.getDataScale()
        : this.model.getVisibleScale()
    ).pixelToPoint(x, y, this.host.getMainCanvas());
    return this.model.getNearestData(this.host.normalizeTime(rawPoint));
  }

  resolvePointer(x: number, y: number): ChartCrosshairState | undefined {
    const pointerY = Math.min(y, this.host.getPlotHeight());
    const dataPoint = this.resolveDataPoint(x, pointerY, "visible");
    if (!dataPoint) return undefined;

    const pane =
      this.paneLayout.getPaneAtY(pointerY) ?? this.paneLayout.getMainPane();
    return {
      time: dataPoint.time,
      y: pointerY,
      paneId: pane.getId(),
      price: this.resolvePrice(pane, pointerY),
      dataPoint
    };
  }

  resolveProgrammatic(
    options: ChartCrosshairOptions
  ): ChartCrosshairState | undefined {
    const dataPoint = this.model.getNearestData(options.time);
    if (!dataPoint) return undefined;

    const x = this.model.getTimeScale().project(dataPoint.time, {
      canvas: this.host.getMainCanvas(),
      barAlignment: this.host.getTimeAnchorAlignment()
    });
    if (x < 0 || x > this.host.getDrawingWidth()) return undefined;

    const pane = this.paneLayout.getPaneById(options.paneId);
    const y = this.resolveY(options, pane, dataPoint);
    return {
      time: dataPoint.time,
      y,
      paneId: pane.getId(),
      price: this.resolvePrice(pane, y),
      dataPoint
    };
  }

  private resolvePrice(pane: Pane, y: number): number {
    const region = pane.getRegion();
    return pane.getPriceScale().unproject(pane.getRelativeY(y), {
      canvas: { width: region.width, height: region.height }
    });
  }

  private resolveY(
    options: ChartCrosshairOptions,
    pane: Pane,
    point: ChartData
  ): number {
    if (options.y !== undefined) {
      return Math.max(0, Math.min(options.y, this.host.getPlotHeight()));
    }

    const region = pane.getRegion();
    const price =
      options.price ?? point.close ?? point.open ?? point.high ?? point.low;
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
}
