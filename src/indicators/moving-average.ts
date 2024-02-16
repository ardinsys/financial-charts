import { Indicator } from "..";

export interface MovingAverageTheme {
  color: string;
  strokeWidth: number;
}

export interface MovingAverageOptions {
  period: number;
  source: "open" | "high" | "low" | "close";
}

export class MovingAverageIndicator extends Indicator<
  MovingAverageTheme,
  MovingAverageOptions
> {
  static ID = "SMA";

  public getDefaultOptions(): MovingAverageOptions {
    return { period: 5, source: "close" };
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
        point.time <= visibleTimeRange.end + this.chart.getOptions().stepSize
      );
    });

    // Setup drawing context
    ctx.beginPath();
    ctx.strokeStyle = this.theme.color;
    ctx.lineWidth = this.theme.strokeWidth;

    visibleDataPoints.forEach((point, index) => {
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
  }
}
