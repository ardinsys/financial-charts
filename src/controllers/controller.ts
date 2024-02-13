import { OHLCDataExtent } from "../extents/ohlc-data-extent";
import { DataExtent } from "../extents/data-extent";
import { SimpleDataExtent } from "../extents/simple-data-extent";
import {
  FinancialChart,
  ChartOptions,
  DeepConcrete,
} from "../chart/financial-chart";
import { ChartData, TimeRange } from "../chart/types";

export abstract class ChartController {
  static ID = "default";

  constructor(
    protected chart: FinancialChart,
    protected options: DeepConcrete<ChartOptions>
  ) {}

  abstract createDataExtent(
    data: ChartData[],
    timeRange: TimeRange
  ): DataExtent;

  abstract getEffectiveCrosshairValues(): boolean[];
  abstract getXLabelOffset(): number;
  abstract getTimeFromRawDataPoint(rawPoint: ChartData): number;
  abstract draw(): void;
}

export abstract class SimpleController extends ChartController {
  private simpleCrosshairValues = [false, false, false, true];

  createDataExtent(data: ChartData[], timeRange: TimeRange): DataExtent {
    return new SimpleDataExtent(data, timeRange);
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
  private ohlcCrosshairValues = [true, true, true, true];

  createDataExtent(data: ChartData[], timeRange: TimeRange): DataExtent {
    return new OHLCDataExtent(data, timeRange);
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
