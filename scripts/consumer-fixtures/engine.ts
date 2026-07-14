import {
  ChartController,
  DataScaleModel,
  Pane,
  PaneledIndicator,
  RenderPipeline,
  TimeTickGenerator,
  calculateYAxisLabels,
  createCanvasLayer,
  type BarAlignment,
  type ChartData,
  type DefaultIndicatorOptions,
  type PaneledIndicatorDrawingContext,
  type ResolvedChartOptions,
  type TimeRange
} from "@ardinsys/financial-charts/engine";

class ExtensionController extends ChartController {
  static readonly ID = "extension-controller";

  createDataScale(data: readonly ChartData[], timeRange: TimeRange) {
    return new DataScaleModel("simple", data, timeRange);
  }

  getEffectiveCrosshairValues(): boolean[] {
    return [false, false, false, true, false];
  }

  getBarAlignment(): BarAlignment {
    return "center";
  }

  getTimeFromRawDataPoint(point: ChartData): number {
    return point.time;
  }

  draw(): void {}
}

class ExtensionPane extends PaneledIndicator<{}, DefaultIndicatorOptions> {
  getDefaultOptions(): DefaultIndicatorOptions {
    return { labelKey: "pane", names: { default: "Pane" } };
  }

  getDefaultThemes(): Record<string, {}> {
    return {};
  }

  createScale(): DataScaleModel {
    return new DataScaleModel("simple", [], { start: 0, end: 1 });
  }

  getCrosshairValue(): string {
    return "";
  }

  protected getLabelContent() {
    return {};
  }

  protected drawPane(_context: PaneledIndicatorDrawingContext): void {}
}

const resolvedOptions = {} as ResolvedChartOptions;

void [
  ExtensionController,
  ExtensionPane,
  Pane,
  RenderPipeline,
  TimeTickGenerator,
  calculateYAxisLabels,
  createCanvasLayer,
  resolvedOptions
];
