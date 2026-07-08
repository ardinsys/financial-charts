import {
  FinancialChart,
  ChartOptions,
  DeepConcrete,
} from "../chart/financial-chart";
import { ChartData, TimeRange } from "../chart/types";
import { DataScaleModel } from "../scales/data-scale-model";

export abstract class ChartController {
  static ID = "default";

  constructor(
    protected chart: FinancialChart,
    protected options: DeepConcrete<ChartOptions>
  ) {}

  abstract createDataScale(
    data: ChartData[],
    timeRange: TimeRange
  ): DataScaleModel;

  abstract getEffectiveCrosshairValues(): boolean[];
  abstract getXLabelOffset(): number;
  abstract getTimeFromRawDataPoint(rawPoint: ChartData): number;
  abstract draw(): void;
}

export abstract class SimpleController extends ChartController {
  private simpleCrosshairValues = [false, false, false, true, true];

  createDataScale(data: ChartData[], timeRange: TimeRange): DataScaleModel {
    return new DataScaleModel("simple", data, timeRange);
  }

  getXLabelOffset(): number {
    return 0;
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

  createDataScale(data: ChartData[], timeRange: TimeRange): DataScaleModel {
    return new DataScaleModel("ohlc", data, timeRange);
  }

  getXLabelOffset(): number {
    return this.options.stepSize / 2;
  }

  getTimeFromRawDataPoint(rawPoint: ChartData): number {
    return rawPoint.time - (rawPoint.time % this.options.stepSize);
  }

  getEffectiveCrosshairValues() {
    return this.ohlcCrosshairValues;
  }
}
