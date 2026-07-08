import { DataScaleModel } from "../../scales/data-scale-model";
import { DefaultIndicatorOptions, indicatorLabelTemplate } from "../indicator";
import { PaneledIndicator } from "../paneled-indicator";

export class TestIndicator extends PaneledIndicator<
  {},
  DefaultIndicatorOptions
> {
  public createExtent(): DataScaleModel {
    return this.chart.getVisibleExtent();
  }

  public updateLabel(_dataTime?: number): void {
    this.labelContainer.querySelector("[data-id=name]")!.textContent =
      this.options.names[this.chart.getOptions().locale] ||
      this.options.names.default ||
      this.options.key;
  }

  public getCrosshairValue(_time: number, _relativeY: number): string {
    return "Hello";
  }

  public draw() {
    // Draw main
    this.initDrawing();
    if (!this.visible) return;

    this.context.fillStyle = "white";
    const size = 10;

    for (const data of this.chart.getLastVisibleDataPoints()) {
      const scaleOptions = {
        canvas: this.canvas,
        zoomLevel: this.chart.getZoomLevel(),
        panOffset: this.chart.getPanOffset(),
        barAlignment: "center" as const
      };
      const x = this.chart.getTimeScale().project(data.time, scaleOptions);
      const priceScale =
        this.pane?.getPriceScale() ?? this.chart.getPriceScale();
      const y = priceScale.project(data.close!, scaleOptions);
      this.context.fillRect(x - size / 2, y, size, size);
    }
  }

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      labelTemplate: indicatorLabelTemplate,
      key: "test",
      names: {
        default: "Test"
      }
    };
  }

  public getDefaultThemes(): Record<string, {}> {
    return {};
  }
}
