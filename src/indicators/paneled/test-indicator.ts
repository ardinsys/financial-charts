import { DataScaleModel } from "../../scales/data-scale-model";
import {
  DefaultIndicatorOptions,
  type IndicatorLabelContent,
} from "../indicator";
import {
  PaneledIndicator,
  type PaneledIndicatorDrawingContext,
} from "../paneled-indicator";
import type { ExtensionThemeDefaults } from "../../plugin/extension-theme";
import type { ChartData, TimeRange } from "../../chart/types";

export class TestIndicator extends PaneledIndicator<
  {},
  DefaultIndicatorOptions
> {
  static ID = "test";

  public createScale(): DataScaleModel {
    return new DataScaleModel(
      "simple",
      this.indicatorContext.getData(),
      this.indicatorContext.getVisibleTimeRange()
    );
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
        default: "Test",
      },
    };
  }

  public getDefaultThemes(): ExtensionThemeDefaults<{}> {
    return { light: {}, dark: {} };
  }
}

export class FixedRangeTestIndicator extends TestIndicator {
  static ID = "fixed-range-test";

  public createScale(): DataScaleModel {
    return new DataScaleModel(
      "simple",
      [
        { time: 0, close: 0 },
        { time: 1, close: 100 },
      ],
      this.indicatorContext.getVisibleTimeRange()
    );
  }

  protected updateScale(
    _data: readonly ChartData[],
    _visibleRange: TimeRange
  ): void {}
}
