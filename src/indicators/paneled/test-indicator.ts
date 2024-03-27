import { DefaultIndicatorOptions, indicatorLabelTemplate } from "../indicator";
import { PaneledIndicator } from "../paneled-indicator";

export class TestIndicator extends PaneledIndicator<
  {},
  DefaultIndicatorOptions
> {
  public updateLabel(dataTime?: number): void {
    this.labelContainer.querySelector("[data-id=name]")!.textContent =
      this.options.names[this.chart.getOptions().locale] ||
      this.options.names.default ||
      this.options.key;
  }

  public getCrosshairValue(time: number, relativeY: number): string {
    return "Hello";
  }

  public draw() {
    // Draw main
    this.initMain();
    if (!this.visible) return;

    this.context.fillStyle = "white";
    const size = 10;

    for (const data of this.chart.getLastVisibleDataPoints()) {
      const point = this.chart
        .getVisibleExtent()
        .mapToPixel(
          data.time + this.chart.getController().getXLabelOffset(),
          data.close!,
          this.canvas,
          this.chart.getZoomLevel(),
          this.chart.getPanOffset()
        );
      this.context.fillRect(point.x - size / 2, point.y, size, size);
    }

    // Draw y axis
    this.initYAxis();

    this.axisContext.fillStyle = "white";
    this.axisContext.fillRect(0, 0, this.chart.getYLabelWidth(), this.height());
  }

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      labelTemplate: indicatorLabelTemplate,
      key: "test",
      names: {
        default: "Test",
      },
    };
  }

  public getDefaultThemes(): Record<string, {}> {
    return {};
  }
}
