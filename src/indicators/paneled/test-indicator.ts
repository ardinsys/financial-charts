import { PaneledIndicator } from "../paneled-indicator";

export class TestIndicator extends PaneledIndicator<{}, {}> {
  static ID = "test";

  public getCrosshairValue(time: number, relativeY: number): string {
    return "Hello";
  }

  public draw() {
    // Draw main
    this.initMain();

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

  public getDefaultOptions(): {} {
    return {};
  }

  public getDefaultThemes(): Record<string, {}> {
    return {};
  }
}
