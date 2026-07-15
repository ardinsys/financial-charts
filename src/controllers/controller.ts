import type { ResolvedChartOptions } from "../chart/chart-options";
import type { ChartData, ChartDataValueKey, TimeRange } from "../chart/types";
import { DataScaleModel } from "../scales/data-scale-model";
import type { BarAlignment } from "../scales/time-scale";

export interface ChartControllerDrawingContext {
  readonly canvasContext: CanvasRenderingContext2D;
  readonly logicalSize: Readonly<{ width: number; height: number }>;
  readonly visibleData: readonly ChartData[];
  readonly timeRange: TimeRange;
  readonly pixelsPerBar: number;
  projectTime(time: number): number;
  projectPrice(price: number): number;
}

export interface ChartControllerContext {
  getDrawingContext(): ChartControllerDrawingContext;
}

export abstract class ChartController {
  static ID = "default";

  constructor(
    protected context: ChartControllerContext,
    protected options: ResolvedChartOptions
  ) {}

  abstract createDataScale(
    data: readonly ChartData[],
    timeRange: TimeRange
  ): DataScaleModel;

  abstract getCrosshairValues(): readonly ChartDataValueKey[];
  abstract getBarAlignment(): BarAlignment;
  getTimeAnchorAlignment(): BarAlignment {
    return "center";
  }
  abstract getTimeFromRawDataPoint(rawPoint: ChartData): number;
  abstract draw(): void;
}

export abstract class SimpleController extends ChartController {
  private static readonly crosshairValues = ["close", "volume"] as const;

  createDataScale(
    data: readonly ChartData[],
    timeRange: TimeRange
  ): DataScaleModel {
    return new DataScaleModel("simple", data, timeRange, {
      barAlignment: this.getBarAlignment()
    });
  }

  getBarAlignment(): BarAlignment {
    return "center";
  }

  getTimeFromRawDataPoint(rawPoint: ChartData): number {
    return (
      Math.round(rawPoint.time / this.options.stepSize) * this.options.stepSize
    );
  }

  getCrosshairValues(): readonly ChartDataValueKey[] {
    return SimpleController.crosshairValues;
  }
}

export abstract class OHLCController extends ChartController {
  private static readonly crosshairValues = [
    "open",
    "high",
    "low",
    "close",
    "volume"
  ] as const;

  createDataScale(
    data: readonly ChartData[],
    timeRange: TimeRange
  ): DataScaleModel {
    return new DataScaleModel("ohlc", data, timeRange, {
      barAlignment: this.getBarAlignment()
    });
  }

  getBarAlignment(): BarAlignment {
    return "edge";
  }

  getTimeFromRawDataPoint(rawPoint: ChartData): number {
    return rawPoint.time - (rawPoint.time % this.options.stepSize);
  }

  getCrosshairValues(): readonly ChartDataValueKey[] {
    return OHLCController.crosshairValues;
  }
}
