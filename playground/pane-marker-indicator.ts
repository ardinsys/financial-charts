import {
  PaneledIndicator,
  type DefaultIndicatorOptions,
  type IndicatorLabelContent,
  type PaneledIndicatorDrawingContext
} from "@ardinsys/financial-charts/extensions";
import { DataScaleModel } from "@ardinsys/financial-charts/engine";

export class PaneMarkerIndicator extends PaneledIndicator<
  {},
  DefaultIndicatorOptions
> {
  static readonly ID = "pane-marker";

  createScale() {
    return new DataScaleModel(
      "simple",
      this.indicatorContext.getData(),
      this.indicatorContext.getVisibleTimeRange()
    );
  }

  protected getLabelContent(): IndicatorLabelContent {
    return {};
  }

  getCrosshairValue(): string {
    return "Price";
  }

  protected drawPane(context: PaneledIndicatorDrawingContext): void {
    context.ctx.fillStyle = "#7c3aed";
    for (const point of context.visibleData) {
      if (point.close == null) continue;
      const { x, y } = context.projectPoint(point.time, point.close);
      context.ctx.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  getDefaultOptions(): DefaultIndicatorOptions {
    return {
      labelKey: "pane-marker",
      names: { default: "Pane Markers" }
    };
  }

  getDefaultThemes(): Record<string, {}> {
    return {};
  }
}
