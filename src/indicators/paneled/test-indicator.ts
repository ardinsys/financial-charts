import { DataScaleModel } from "../../scales/data-scale-model";
import {
  DefaultIndicatorOptions,
  type IndicatorLabelContent
} from "../indicator";
import {
  PaneledIndicator,
  type PaneledIndicatorDrawingContext
} from "../paneled-indicator";

export class TestIndicator extends PaneledIndicator<
  {},
  DefaultIndicatorOptions
> {
  static ID = "test";

  public createScale(): DataScaleModel {
    return this.chart.getVisibleScale();
  }

  protected getLabelContent(): IndicatorLabelContent {
    return {};
  }

  public getCrosshairValue(_time: number, _relativeY: number): string {
    return "Hello";
  }

  protected drawPane(context: PaneledIndicatorDrawingContext) {
    context.ctx.fillStyle = "white";
    const size = 10;

    for (const data of context.visibleData) {
      const { x, y } = context.projectPoint(data.time, data.close!);
      context.ctx.fillRect(x - size / 2, y, size, size);
    }
  }

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      labelKey: "test",
      names: {
        default: "Test"
      }
    };
  }

  public getDefaultThemes(): Record<string, {}> {
    return {};
  }
}
