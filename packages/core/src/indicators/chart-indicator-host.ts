import type { ChartModel } from "../chart/chart-model";
import type { ChartRedrawPart } from "../render/chart-render-types";
import type { ChartRenderer } from "../render/chart-renderer";
import type { ChartExtensionReadModel } from "../plugin/chart-extension-read-model";
import type { ExtensionContext } from "../plugin/chart-plugin";
import type {
  Indicator,
  IndicatorContext,
  IndicatorDrawingContext,
  IndicatorInvalidationOptions,
} from "./indicator";

const scaleRedrawParts: readonly ChartRedrawPart[] = [
  "grid",
  "axes",
  "series",
  "indicators",
  "annotations",
  "crosshair",
];

interface ChartIndicatorOperations {
  getCrosshairTime(): number | undefined;
  recalculateVisibleScale(): void;
  removeIndicator(indicator: Indicator<any, any>): void;
}

export class ChartIndicatorHost {
  constructor(
    private readonly model: ChartModel,
    private readonly renderer: ChartRenderer,
    private readonly readModel: ChartExtensionReadModel,
    private readonly operations: ChartIndicatorOperations
  ) {}

  createContext(
    indicator: Indicator<any, any>,
    extension: ExtensionContext
  ): IndicatorContext {
    return {
      ...extension,
      getLocaleValues: () => this.readModel.getLocaleValues(),
      getDrawingContext: (visible) => this.getDrawingContext(visible),
      getLastXGridCoords: () => this.renderer.getLastXGridCoords(),
      invalidate: (options) =>
        this.invalidate(indicator, extension.signal, options),
      remove: () => {
        if (!extension.signal.aborted) {
          this.operations.removeIndicator(indicator);
        }
      },
    };
  }

  private getDrawingContext(visible: boolean): IndicatorDrawingContext {
    const ctx = this.renderer.getContext("indicator");
    const canvas = ctx.canvas;
    const timeScale = this.model.getTimeScale();
    const priceScale = this.model.getVisibleScale().getPriceScale();
    const barAlignment = this.model.getBarAlignment();
    const scaleOptions = { canvas, barAlignment };
    const options = this.readModel.getOptions();

    return {
      ctx,
      canvas,
      data: this.readModel.getData(),
      visibleData: this.model.getVisibleDataPoints(),
      visibleTimeRange: this.readModel.getVisibleTimeRange(),
      visible,
      stepSize: options.stepSize,
      formatter: options.formatter,
      theme: options.theme,
      projectTime: (time, alignment = barAlignment) =>
        timeScale.project(time, { canvas, barAlignment: alignment }),
      projectPrice: (value) => priceScale.project(value, scaleOptions),
      projectPoint: (time, value, alignment = barAlignment) => ({
        x: timeScale.project(time, { canvas, barAlignment: alignment }),
        y: priceScale.project(value, scaleOptions),
      }),
    };
  }

  private invalidate(
    indicator: Indicator<any, any>,
    signal: AbortSignal,
    options: IndicatorInvalidationOptions = {}
  ): void {
    if (signal.aborted) return;

    const redrawParts = new Set<ChartRedrawPart>();
    if (options.scale && this.model.hasData()) {
      this.operations.recalculateVisibleScale();
      for (const part of scaleRedrawParts) redrawParts.add(part);
    }
    if (options.label ?? true) {
      indicator.refreshLabel(this.operations.getCrosshairTime());
    }
    if (options.drawing ?? true) redrawParts.add("indicators");
    if (options.crosshair ?? true) redrawParts.add("crosshair");

    if (redrawParts.size > 0) {
      this.renderer.requestRedraw([...redrawParts]);
    }
  }
}
