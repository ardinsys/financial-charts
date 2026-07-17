import {
  DefaultIndicatorOptions,
  Indicator,
  type IndicatorDrawingContext,
  type IndicatorLabelContent,
} from "../indicator";
import type { ChartData, TimeRange } from "../../chart/types";
import type { ExtensionThemeDefaults } from "../../plugin/extension-theme";

export interface MovingAverageTheme {
  color: string;
  strokeWidth: number;
}

export interface MovingAverageOptions extends DefaultIndicatorOptions {
  period: number;
  source: "open" | "high" | "low" | "close";
}

export class MovingAverageIndicator extends Indicator<
  MovingAverageTheme,
  MovingAverageOptions
> {
  static ID = "moving-average";

  private cache = new Map<number, number>();

  public getDefaultOptions(): MovingAverageOptions {
    return {
      period: 5,
      source: "close",
      labelKey: "SMA",
      names: {
        default: "Simple Moving Average",
      },
    };
  }

  public getDefaultThemes(): ExtensionThemeDefaults<MovingAverageTheme> {
    return {
      light: {
        color: "#2962FF",
        strokeWidth: 2,
      },
      dark: {
        color: "#2962FF",
        strokeWidth: 2,
      },
    };
  }

  protected getLabelContent(dataTime?: number): IndicatorLabelContent {
    const detail =
      this.options.period +
      " " +
      this.indicatorContext.getLocaleValues().common.sources[
        this.options.source
      ];

    if (dataTime == undefined) return { detail };

    const sma = this.cache.get(dataTime);
    if (sma == undefined) return { detail };

    return {
      detail,
      segments: [
        {
          text: this.indicatorContext.getOptions().formatter.formatPrice(sma),
          color: this.theme.color,
        },
      ],
    };
  }

  public draw(): void {
    const context = this.getDrawingContext();
    const visibleDataPoints = this.getVisibleMovingAveragePoints(context);
    this.cache.clear();

    for (const point of visibleDataPoints) {
      this.cache.set(point.time, point.movingAverage);
    }

    if (!context.visible) return;

    context.ctx.beginPath();
    context.ctx.strokeStyle = this.theme.color;
    context.ctx.lineWidth = this.theme.strokeWidth;

    visibleDataPoints.forEach((point, index) => {
      const { x, y } = context.projectPoint(point.time, point.movingAverage);

      if (index === 0) {
        context.ctx.moveTo(x, y);
      } else {
        context.ctx.lineTo(x, y);
      }
    });

    context.ctx.stroke();
  }

  private getVisibleMovingAveragePoints(context: IndicatorDrawingContext) {
    return this.getMovingAveragePoints(context.data).filter((point) =>
      this.isVisible(point.time, context.visibleTimeRange, context.stepSize)
    );
  }

  private getMovingAveragePoints(data: readonly ChartData[]) {
    const movingAveragePoints: Array<{
      time: number;
      movingAverage: number;
    }> = [];
    let sum = 0;
    let valueCount = 0;

    for (let i = 0; i < data.length; i++) {
      const value = data[i][this.options.source];
      if (value != null) {
        sum += value;
        valueCount += 1;
      }

      if (i >= this.options.period) {
        const expired = data[i - this.options.period][this.options.source];
        if (expired != null) {
          sum -= expired;
          valueCount -= 1;
        }
      }

      if (value == null) continue;
      // Warm-up uses the available values in the growing trailing window.
      movingAveragePoints.push({
        time: data[i].time,
        movingAverage: sum / valueCount,
      });
    }

    return movingAveragePoints;
  }

  private isVisible(time: number, range: TimeRange, stepSize: number) {
    return time >= range.start - stepSize && time < range.end;
  }
}
