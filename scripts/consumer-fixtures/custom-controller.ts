import {
  ChartController,
  DataScaleModel,
  type BarAlignment,
  type ChartData,
  type ChartDataValueKey,
  type ControllerConstructor,
  type TimeRange
} from "@ardinsys/financial-charts/engine";

class CloseController extends ChartController {
  static readonly ID = "close";

  createDataScale(
    data: readonly ChartData[],
    timeRange: TimeRange
  ): DataScaleModel {
    return new DataScaleModel("simple", data, timeRange, {
      barAlignment: this.getBarAlignment()
    });
  }

  getCrosshairValues(): readonly ChartDataValueKey[] {
    return ["close", "volume"];
  }

  getBarAlignment(): BarAlignment {
    return "center";
  }

  getTimeFromRawDataPoint(point: ChartData): number {
    return (
      Math.round(point.time / this.options.stepSize) * this.options.stepSize
    );
  }

  draw(): void {
    const context = this.chart.getContext("main");
    const points = this.chart.getLastVisibleDataPoints();
    const timeScale = this.chart.getTimeScale();
    const priceScale = this.chart.getPriceScale();
    const scaleOptions = { canvas: context.canvas };
    let started = false;

    context.beginPath();
    for (const point of points) {
      if (point.close == null) continue;

      const x = timeScale.project(point.time, scaleOptions);
      const y = priceScale.project(point.close, scaleOptions);
      if (started) {
        context.lineTo(x, y);
      } else {
        context.moveTo(x, y);
        started = true;
      }
    }
    context.stroke();
  }
}

const controller: ControllerConstructor = CloseController;

void controller;
