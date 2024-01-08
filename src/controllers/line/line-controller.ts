import { ChartController } from "../controller";
import { DataExtent } from "../data-extent";
import { ChartData, TimeRange } from "../types";
import { LineDataExtent } from "./line-data-extent";

export interface LineChartOptions {
  stroke: {
    width: number;
    color: string;
  };
  stepSize: number;
}

export class LineController extends ChartController<LineChartOptions> {
  protected getMaxZoomLevel(): number {
    return 5;
  }
  protected transformData(data: ChartData[]): ChartData[] {
    return this.mapDataToStepSize(data, this.options.stepSize);
  }

  private canDrawWithOptimization = false;

  protected transformNewData(data: ChartData): ChartData {
    const d =
      data.time % this.options.stepSize === 0
        ? data
        : { ...data, time: data.time - (data.time % this.options.stepSize) };

    if (this.data.length === 0) return d;

    const lastData = this.data.pop()!;

    if (d.time === lastData.time) {
      return {
        ...lastData,
        open: lastData.open!,
        high: Math.max(lastData.high!, d.high!),
        low: Math.min(lastData.low!, d.low!),
        close: d.close!,
      };
    } else {
      const range = this.getVisibleTimeRange();
      const inVisibleRange = d.time >= range.start && d.time <= range.end;
      if (inVisibleRange) {
        this.canDrawWithOptimization = !this.visibleExtent.addDataPoint(d);
      }
      this.data.push(lastData);
      return d;
    }
  }

  private visibleExtent: DataExtent = new LineDataExtent([], {
    start: 0,
    end: 0,
  });

  private xLabelStartX = Infinity;

  protected createDataExtent(
    data: ChartData[],
    timeRange: TimeRange
  ): DataExtent {
    return new LineDataExtent(data, timeRange);
  }

  constructor(
    container: HTMLElement,
    timeRange: TimeRange,
    options: LineChartOptions
  ) {
    super(container, timeRange, options);
  }

  private roundToNiceNumber(number: number) {
    const orderOfMagnitude = Math.pow(10, Math.floor(Math.log10(number)));
    const fraction = number / orderOfMagnitude;

    let niceFraction;
    if (fraction < 1.5) {
      niceFraction = 1;
    } else if (fraction < 3) {
      niceFraction = 2;
    } else if (fraction < 7) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }

    return niceFraction * orderOfMagnitude;
  }

  private calculateYAxisLabels(
    maxPrice: number,
    minPrice: number,
    canvasHeight: number,
    labelSpacing: number
  ) {
    const priceRange = maxPrice - minPrice;
    let maxLabels = Math.floor(canvasHeight / labelSpacing);
    let stepSize = priceRange / maxLabels;
    let roundedStepSize = this.roundToNiceNumber(stepSize);

    // Adjust maxLabels based on the new step size
    maxLabels = Math.ceil(priceRange / roundedStepSize);

    // Recalculate the min and max prices to fit the new step size
    const newMinPrice =
      Math.floor(minPrice / roundedStepSize) * roundedStepSize;
    const newMaxPrice = newMinPrice + roundedStepSize * maxLabels;

    return { newMinPrice, newMaxPrice, roundedStepSize, maxLabels };
  }

  private drawYAxis(): void {
    const padding = 40;

    const { newMinPrice, newMaxPrice, roundedStepSize, maxLabels } =
      this.calculateYAxisLabels(
        this.visibleExtent.getYMax(),
        this.visibleExtent.getYMin(),
        this.getCanvas("y-label").height,
        padding
      );
    const decimals = Math.max(0, -Math.floor(Math.log10(roundedStepSize)));
    const priceFormat = new Intl.NumberFormat("hu", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals,
    });

    const ctx = this.getContext("y-label");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "white";
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.font = "12px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yAxisValues: number[] = [];
    for (let i = 0; i <= maxLabels; i++) {
      const price = newMinPrice + i * roundedStepSize;
      yAxisValues.push(price);
    }

    for (let i = 0; i < yAxisValues.length; i++) {
      const value = yAxisValues[i];
      const { y } = this.visibleExtent.mapToPixel(
        this.getVisibleTimeRange().start,
        value,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      );

      const text = priceFormat.format(value);
      const textWidth = ctx.measureText(text).width;

      ctx.fillText(
        text,
        (ctx.canvas.width - textWidth) / 2 + textWidth,
        y + (i == 0 ? 8 : i == maxLabels ? -8 : 0)
      );
      const mainCtx = this.getContext("main");

      mainCtx.lineWidth = 1;
      mainCtx.strokeStyle = "#F2F3F3";
      mainCtx.beginPath();
      mainCtx.moveTo(0, y);
      mainCtx.lineTo(mainCtx.canvas.width, y);
      mainCtx.stroke();
    }

    ctx.strokeStyle = "#9598A1";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, ctx.canvas.height);
    ctx.stroke();
  }

  private drawXAxis(): void {
    const ctx = this.getContext("x-label");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "white";
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fill();

    ctx.strokeStyle = "#9598A1";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ctx.canvas.width, 0);
    ctx.stroke();

    ctx.fillStyle = "#000";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    const canvasWidth = ctx.canvas.width - this.yLabelWidth;

    const padding = 20;

    let startTime = this.dataExtent.getXMin();
    let endTime = this.dataExtent.getXMax();
    const dateFormat = new Intl.DateTimeFormat("hu", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let stepSize = this.options.stepSize;

    while (this.xLabelStartX === Infinity && startTime < endTime) {
      const text = dateFormat.format(startTime);

      const { x } = this.dataExtent.mapToPixel(
        startTime,
        0,
        { width: canvasWidth, height: 0 } as HTMLCanvasElement,
        this.zoomLevel,
        this.panOffset
      );
      const textWidth = ctx.measureText(text).width;

      if (x - textWidth / 2 > 0) {
        this.xLabelStartX = startTime;
        break;
      }
      startTime += this.options.stepSize;
    }

    const firstXEnd =
      this.dataExtent.mapToPixel(
        this.xLabelStartX,
        0,
        { width: canvasWidth, height: 0 } as HTMLCanvasElement,
        this.zoomLevel,
        this.panOffset
      ).x +
      ctx.measureText(dateFormat.format(this.xLabelStartX)).width / 2;

    startTime = this.dataExtent.getXMin();

    while (startTime < endTime) {
      const text = dateFormat.format(startTime);

      const { x } = this.dataExtent.mapToPixel(
        startTime,
        0,
        { width: canvasWidth, height: 0 } as HTMLCanvasElement,
        this.zoomLevel,
        this.panOffset
      );
      const textWidth = ctx.measureText(text).width;

      if (x - textWidth / 2 > firstXEnd + padding) {
        stepSize = Math.abs(startTime - this.xLabelStartX);
        break;
      }
      startTime += this.options.stepSize;
    }

    let start = this.xLabelStartX;
    let endX = this.dataExtent.mapToPixel(
      start,
      0,
      { width: canvasWidth, height: 0 } as HTMLCanvasElement,
      this.zoomLevel,
      this.panOffset
    ).x;
    const text = dateFormat.format(start);
    const textWidth = ctx.measureText(text).width;
    endX += textWidth / 2 + padding;

    while (start < endTime) {
      const text = dateFormat.format(start);

      const { x } = this.dataExtent.mapToPixel(
        start,
        0,
        { width: canvasWidth, height: 0 } as HTMLCanvasElement,
        this.zoomLevel,
        this.panOffset
      );
      const textWidth = ctx.measureText(text).width;

      if (x - textWidth / 2 > endX || start === this.xLabelStartX) {
        ctx.fillText(text, x - textWidth / 2, ctx.canvas.height - 15);

        const mainCtx = this.getContext("main");

        mainCtx.lineWidth = 1;
        mainCtx.strokeStyle = "#F2F3F3";
        mainCtx.beginPath();
        mainCtx.moveTo(x, 0);
        mainCtx.lineTo(x, mainCtx.canvas.height);
        mainCtx.stroke();

        endX = x + textWidth / 2 + padding;
      }

      start += stepSize;
    }
  }

  protected drawChart(): void {
    const ctx = this.getContext("main");
    const pixelPerSecond =
      ctx.canvas.width / (this.timeRange.end - this.timeRange.start);

    const visibleTimeRange = this.getVisibleTimeRange();
    let firstPointIndex = 0;
    let lastPointIndex = this.data.length - 1;

    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i].time >= visibleTimeRange.start - this.options.stepSize) {
        firstPointIndex = i;
        break;
      }
    }

    for (let i = this.data.length - 1; i >= 0; i--) {
      if (this.data[i].time <= visibleTimeRange.end) {
        lastPointIndex = i;
        break;
      }
    }

    const visibleDataPoints = this.data.slice(
      firstPointIndex,
      lastPointIndex + 1
    );

    // Do not recalc xMin and xMax to preserve x positions
    // but we need to adjust yMin and yMax to the visible data points
    this.visibleExtent.recalculate(visibleDataPoints, this.timeRange);

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawYAxis();
    this.drawXAxis();

    ctx.fillStyle = this.options.stroke.color;
    ctx.lineWidth = this.options.stroke.width;
    ctx.beginPath();
    ctx.strokeStyle = this.options.stroke.color;
    ctx.lineWidth = this.options.stroke.width;
    let firstPoint = true;

    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
      if (point.time < this.timeRange.start) continue;
      if (point.time > this.timeRange.end) break;
      const { x, y } = this.visibleExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      );

      if (firstPoint) {
        ctx.moveTo(x, y);
        firstPoint = false;
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  protected drawNewChartPoint(_: ChartData): void {
    if (!this.canDrawWithOptimization) {
      this.drawChart();
      return;
    }

    this.canDrawWithOptimization = false;

    const data = this.data[this.data.length - 1];
    const ctx = this.getContext("main");

    const { x, y } = this.visibleExtent.mapToPixel(
      data.time,
      data.close!,
      ctx.canvas,
      this.zoomLevel,
      this.panOffset
    );
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  protected pointerMove(e: { x: number; y: number }) {
    // TODO: crosshair and stuff
  }

  private mapDataToStepSize(data: ChartData[], stepSize: number): ChartData[] {
    if (data.length === 0) return data;
    data = data.map((d) => {
      return d.time % stepSize === 0
        ? d
        : { ...d, time: d.time - (d.time % stepSize) };
    });

    // merge data points that has the same time
    const mergedData: ChartData[] = [];
    let lastData: ChartData | undefined;

    for (const d of data) {
      if (!lastData) {
        lastData = d;
        continue;
      }

      if (d.time === lastData.time) {
        // set last data but do not override open!
        // setup high, low and close
        lastData = {
          ...lastData,
          open: lastData.open!,
          high: Math.max(lastData.high!, d.high!),
          low: Math.min(lastData.low!, d.low!),
          close: d.close!,
        };
      } else {
        mergedData.push(lastData);
        lastData = d;
      }
    }

    mergedData.push(lastData!);

    return mergedData;
  }
}
