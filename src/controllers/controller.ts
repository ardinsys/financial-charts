import type {
  FinancialChart,
  ResolvedChartOptions
} from "../chart/financial-chart";
import type { ChartData, TimeRange } from "../chart/types";
import { DataScaleModel } from "../scales/data-scale-model";
import type { BarAlignment } from "../scales/time-scale";

export abstract class ChartController {
  static ID = "default";

  constructor(
    protected chart: FinancialChart,
    protected options: ResolvedChartOptions
  ) {}

  abstract createDataScale(
    data: readonly ChartData[],
    timeRange: TimeRange
  ): DataScaleModel;

  abstract getEffectiveCrosshairValues(): boolean[];
  abstract getBarAlignment(): BarAlignment;
  getTimeAnchorAlignment(): BarAlignment {
    return "center";
  }
  abstract getTimeFromRawDataPoint(rawPoint: ChartData): number;
  abstract draw(): void;
}

export abstract class SimpleController extends ChartController {
  private simpleCrosshairValues = [false, false, false, true, true];

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

  getEffectiveCrosshairValues() {
    return this.simpleCrosshairValues;
  }
}

export abstract class OHLCController extends ChartController {
  private ohlcCrosshairValues = [true, true, true, true, true];

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

  getEffectiveCrosshairValues() {
    return this.ohlcCrosshairValues;
  }
}
