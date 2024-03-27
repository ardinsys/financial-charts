import {
  DefaultIndicatorOptions,
  Indicator,
  indicatorLabelTemplate,
} from "../indicator";

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
  private cache = new Map<number, number>();

  public getDefaultOptions(): MovingAverageOptions {
    return {
      period: 5,
      source: "close",
      labelTemplate: indicatorLabelTemplate,
      key: "SMA",
      names: {
        default: "Simple Moving Average",
        "en-US": "Simple Moving Average",
        "hu-HU": "Egyszerű mozgó átlag",
      },
    };
  }

  public getDefaultThemes(): Record<string, MovingAverageTheme> {
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

  public updateLabel(dataTime?: number): void {
    this.labelContainer.querySelector("[data-id=name]")!.textContent =
      this.options.names[this.chart.getOptions().locale] ||
      this.options.names.default ||
      this.options.key;

    this.labelContainer.querySelector("[data-id=extra]")!.textContent =
      this.options.period +
      " " +
      this.chart.getLocaleValues().common.sources[this.options.source];
    let time: number = dataTime!;

    if (time == undefined) {
      const lastPoints = this.chart.getLastVisibleDataPoints();
      const allPoints = this.chart.getData();

      if (lastPoints.length > 0) {
        time = lastPoints.at(-1)!.time;
      } else if (allPoints.length > 0) {
        time = allPoints.at(-1)!.time;
      } else {
        return;
      }
    }

    const sma = this.cache.get(time);
    if (sma == undefined) return;

    const valueContainer = this.labelContainer.querySelector(
      "[data-id=value]"
    ) as HTMLElement;

    if (valueContainer) {
      valueContainer.style.color = this.theme.color;
      valueContainer.textContent = this.chart.getFormatter().formatPrice(sma);
    }
  }

  public draw(): void {
    const ctx = this.chart.getContext("indicator");
    const visibleTimeRange = this.chart.getVisibleTimeRange();

    const data = this.chart.getData(); // Assuming this returns the entire dataset
    let sum = 0;
    let movingAveragePoints = [];

    // Calculate the moving average for the entire dataset
    for (let i = 0; i < data.length; i++) {
      if (data[i][this.options.source] === undefined) continue;

      sum += data[i][this.options.source]!;
      let divisor = Math.min(i + 1, this.options.period); // Determine the divisor, which is either the period or the number of points so far
      const movingAverage = sum / divisor;
      movingAveragePoints.push({
        time: data[i].time,
        movingAverage: movingAverage,
      });

      // Once enough points are available, start removing the oldest data point from the sum
      if (i >= this.options.period - 1) {
        sum -= data[i - this.options.period + 1][this.options.source]!;
      }
    }

    // Filter the moving average points to only those visible
    const visibleDataPoints = movingAveragePoints.filter((point) => {
      return (
        point.time >=
          visibleTimeRange.start - this.chart.getOptions().stepSize &&
        point.time < visibleTimeRange.end
      );
    });

    if (this.visible) {
      // Setup drawing context
      ctx.beginPath();
      ctx.strokeStyle = this.theme.color;
      ctx.lineWidth = this.theme.strokeWidth;

      visibleDataPoints.forEach((point, index) => {
        this.cache.set(point.time, point.movingAverage);

        const { x, y } = this.chart
          .getVisibleExtent()
          .mapToPixel(
            point.time + this.chart.getController().getXLabelOffset(),
            point.movingAverage,
            this.chart.getContext("main").canvas,
            this.chart.getZoomLevel(),
            this.chart.getPanOffset()
          );

        // Move to the first point or draw line to subsequent points
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    } else {
      visibleDataPoints.forEach((point) => {
        this.cache.set(point.time, point.movingAverage);
      });
    }
  }
}
