import { ChartController } from "../controller";
import { DataExtent } from "../data-extent";
import { ChartData, TimeRange } from "../types";
import { CandlestickDataExtent } from "./candle-data-extent";

export interface CandlestickChartOptions {
  color?: {
    up?: string;
    down?: string;
  };
  stepSize: number;
}

export class CandlestickController extends ChartController<CandlestickChartOptions> {
  private spacing = 0.1;

  protected getMaxZoomLevel(): number {
    return 5;
  }

  protected createDataExtent(
    data: ChartData[],
    timeRange: TimeRange
  ): DataExtent {
    return new CandlestickDataExtent(data, timeRange);
  }

  constructor(
    container: HTMLElement,
    timeRange: TimeRange,
    options: CandlestickChartOptions
  ) {
    super(container, timeRange, {
      stepSize: options.stepSize,
      color: {
        up: options.color?.up || "#089981",
        down: options.color?.down || "#F23645",
        ...options.color,
      },
    });
  }

  private drawYAxis(): void {
    const ctx = this.getContext("y-label");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "white";
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.font = "12px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const yAxisValues = this.dataExtent.getYAxisValues(ctx, 30);

    for (const value of yAxisValues) {
      const { y } = this.dataExtent.mapToPixel(
        this.timeRange.start,
        value,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      );

      ctx.fillText(value.toFixed(2), ctx.canvas.width - 5, y);

      const mainCtx = this.getContext("main");

      mainCtx.lineWidth = 1;
      mainCtx.strokeStyle = "#F2F3F3";
      mainCtx.beginPath();
      mainCtx.moveTo(0, y);
      mainCtx.lineTo(mainCtx.canvas.width, y);
      mainCtx.stroke();
    }
  }

  private xLabelStartX = Infinity;

  private drawXAxis(): void {
    const ctx = this.getContext("x-label");
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "white";
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fill();

    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ctx.canvas.width, 0);
    ctx.stroke();

    ctx.fillStyle = "#000";
    ctx.font = "12px monospace";
    ctx.textBaseline = "middle";
    const canvasWidth = ctx.canvas.width - 60;

    const padding = 15;

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
        startTime + this.options.stepSize / 2,
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
        startTime + this.options.stepSize / 2,
        0,
        { width: canvasWidth, height: 0 } as HTMLCanvasElement,
        this.zoomLevel,
        this.panOffset
      );
      const textWidth = ctx.measureText(text).width;

      if (x - textWidth / 2 - padding > firstXEnd + padding) {
        stepSize = Math.abs(startTime - this.xLabelStartX);
        break;
      }
      startTime += this.options.stepSize;
    }

    let start = this.xLabelStartX;

    while (start < endTime) {
      const text = dateFormat.format(start);

      const { x } = this.dataExtent.mapToPixel(
        start + this.options.stepSize / 2,
        0,
        { width: canvasWidth, height: 0 } as HTMLCanvasElement,
        this.zoomLevel,
        this.panOffset
      );
      const textWidth = ctx.measureText(text).width;

      ctx.fillText(text, x - textWidth / 2, ctx.canvas.height - 30 / 2);
      start += stepSize;

      const mainCtx = this.getContext("main");

      mainCtx.lineWidth = 1;
      mainCtx.strokeStyle = "#F2F3F3";
      mainCtx.beginPath();
      mainCtx.moveTo(x, 0);
      mainCtx.lineTo(x, mainCtx.canvas.height);
      mainCtx.stroke();

      ctx.lineWidth = 1;
      ctx.strokeStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 10);
      ctx.stroke();
    }
  }

  protected drawChart(): void {
    const ctx = this.getContext("main");

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.drawYAxis();
    this.drawXAxis();

    const pixelPerSecond =
      ctx.canvas.width / (this.timeRange.end - this.timeRange.start);
    const candleSpacing =
      this.options.stepSize * pixelPerSecond * this.zoomLevel * this.spacing;
    const candleWidth =
      this.options.stepSize * pixelPerSecond * this.zoomLevel - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

    for (let i = 0; i < this.data.length; i++) {
      const point = this.data[i];
      if (point.time < this.timeRange.start) continue;
      if (point.time > this.timeRange.end) break;

      const { x } = this.dataExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      );

      const high = this.dataExtent.mapToPixel(
        point.time,
        point.high!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      ).y;

      const low = this.dataExtent.mapToPixel(
        point.time,
        point.low!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      ).y;

      const open = this.dataExtent.mapToPixel(
        point.time,
        point.open!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      ).y;

      const close = this.dataExtent.mapToPixel(
        point.time,
        point.close!,
        ctx.canvas,
        this.zoomLevel,
        this.panOffset
      ).y;

      // Draw the high-low line
      ctx.beginPath();
      ctx.strokeStyle =
        point.close! > point.open!
          ? this.options.color.up
          : this.options.color.down;
      ctx.moveTo(x + candleWidth / 2 + candleSpacing / 2, high);
      ctx.lineTo(x + candleWidth / 2 + candleSpacing / 2, low);
      ctx.stroke();

      // Draw the open-close box
      ctx.beginPath();
      ctx.fillStyle =
        point.close! > point.open!
          ? this.options.color.up
          : this.options.color.down;
      ctx.rect(
        x + candleSpacing / 2,
        Math.min(open, close),
        candleWidth,
        Math.abs(open - close)
      );
      ctx.fill();
    }
  }

  private isNewCandle = false;

  protected drawNewChartPoint(_: ChartData): void {
    if (this.isNewCandle) {
      this.drawChart();
      this.isNewCandle = false;
      return;
    }

    const data = this.data[this.data.length - 1];
    const ctx = this.getContext("main");
    const pixelPerSecond =
      ctx.canvas.width / (this.timeRange.end - this.timeRange.start);
    const candleSpacing =
      this.options.stepSize * pixelPerSecond * this.zoomLevel * this.spacing;
    const candleWidth =
      this.options.stepSize * pixelPerSecond * this.zoomLevel - candleSpacing;

    ctx.lineWidth = Math.min(1, candleWidth / 5);

    const { x } = this.dataExtent.mapToPixel(
      data.time,
      data.close!,
      ctx.canvas,
      this.zoomLevel,
      this.panOffset
    );

    const high = this.dataExtent.mapToPixel(
      data.time,
      data.high!,
      ctx.canvas,
      this.zoomLevel,
      this.panOffset
    ).y;

    const low = this.dataExtent.mapToPixel(
      data.time,
      data.low!,
      ctx.canvas,
      this.zoomLevel,
      this.panOffset
    ).y;

    const open = this.dataExtent.mapToPixel(
      data.time,
      data.open!,
      ctx.canvas,
      this.zoomLevel,
      this.panOffset
    ).y;

    const close = this.dataExtent.mapToPixel(
      data.time,
      data.close!,
      ctx.canvas,
      this.zoomLevel,
      this.panOffset
    ).y;

    // Draw the high-low line
    ctx.beginPath();
    ctx.strokeStyle =
      data.close! > data.open!
        ? this.options.color.up
        : this.options.color.down;
    ctx.moveTo(x + candleWidth / 2 + candleSpacing / 2, high);
    ctx.lineTo(x + candleWidth / 2 + candleSpacing / 2, low);
    ctx.stroke();

    // Draw the open-close box
    ctx.beginPath();
    ctx.fillStyle =
      data.close! > data.open!
        ? this.options.color.up
        : this.options.color.down;

    ctx.rect(
      x + candleSpacing / 2,
      Math.min(open, close),
      candleWidth,
      Math.abs(open - close)
    );
    ctx.fill();
  }

  protected pointerMove(e: { x: number; y: number }) {
    // TODO: crosshair and stuff
    this.timeRange;
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

  protected transformData(data: ChartData[]): ChartData[] {
    return this.mapDataToStepSize(data, this.options.stepSize);
  }

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
      this.isNewCandle = true;
      this.data.push(lastData);
      return d;
    }
  }
}
