import type { ResolvedChartOptions } from "../chart/chart-options";
import type { ChartData, ChartDataValueKey, TimeRange } from "../chart/types";
import { DataStore, type TimeBucketPolicy } from "../data/data-store";
import { DataScaleModel } from "../scales/data-scale-model";
import type { BarAlignment } from "../scales/time-scale";

export interface ChartControllerDrawingContext {
  readonly canvasContext: CanvasRenderingContext2D;
  readonly logicalSize: Readonly<{ width: number; height: number }>;
  readonly visibleData: readonly ChartData[];
  readonly visibleStartIndex: number;
  readonly timeRange: TimeRange;
  readonly pixelsPerBar: number;
  projectIndex(index: number): number;
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

  protected bucketTime(time: number, policy: TimeBucketPolicy): number {
    return DataStore.bucketTime(time, this.options.stepSize, policy);
  }
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
    return this.bucketTime(rawPoint.time, "round");
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
    return this.bucketTime(rawPoint.time, "floor");
  }

  getCrosshairValues(): readonly ChartDataValueKey[] {
    return OHLCController.crosshairValues;
  }
}
