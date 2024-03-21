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

    for (const data of this.chart.getLastVisibleDataPoints()) {
      const point = this.chart.getVisibleExtent().mapToPixel(
        data.time + this.chart.getController().getXLabelOffset(),
        data.close!,
        {
          width:
            this.canvas.width -
            (this.chart.getYLabelWidth() * window.devicePixelRatio || 1),
          height: this.canvas.height,
        },
        this.chart.getZoomLevel(),
        this.chart.getPanOffset()
      );
      this.context.fillRect(point.x, point.y, 10, 10);
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
