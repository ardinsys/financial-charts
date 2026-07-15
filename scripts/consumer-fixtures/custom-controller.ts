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
    const {
      canvasContext,
      visibleData,
      projectTime,
      projectPrice
    } = this.context.getDrawingContext();
    let started = false;

    canvasContext.beginPath();
    for (const point of visibleData) {
      if (point.close == null) continue;

      const x = projectTime(point.time);
      const y = projectPrice(point.close);
      if (started) {
        canvasContext.lineTo(x, y);
      } else {
        canvasContext.moveTo(x, y);
        started = true;
      }
    }
    canvasContext.stroke();

    // @ts-expect-error Controllers cannot issue application commands.
    this.context.setData([]);
  }
}

const controller: ControllerConstructor = CloseController;

void controller;
