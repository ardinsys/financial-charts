import { AxisLabel } from "../chart/types";
import { Extent } from "../extents/extent";
import { DefaultIndicatorOptions, Indicator } from "./indicator";

export interface InitParams {
  width: number;
  height: number;
  y: number;
  x: number;
  devicePixelRatio: number;
}

export abstract class PaneledIndicator<
  TTheme extends object,
  TOptions extends DefaultIndicatorOptions
> extends Indicator<TTheme, TOptions> {
  protected container!: HTMLElement;
  protected canvas!: HTMLCanvasElement;
  protected axisCanvas!: HTMLCanvasElement;
  protected context!: CanvasRenderingContext2D;
  protected axisContext!: CanvasRenderingContext2D;
  protected extent!: Extent;

  public abstract createExtent(): Extent;

  private adjustCanvas(
    canvas: HTMLCanvasElement,
    params: InitParams,
    isMain: boolean
  ) {
    canvas.style.userSelect = "none";
    // @ts-ignore
    canvas.style.webkitTapHighlightColor = "transparent";
    canvas.style.position = "absolute";
    canvas.style.left = isMain ? "0px" : this.width() + "px";
    canvas.style.top = "0px";
    canvas.style.width = isMain
      ? params.width - this.chart.getYLabelWidth() + "px"
      : this.chart.getYLabelWidth() + "px";
    canvas.style.height = params.height + "px";
    canvas.width = isMain
      ? (params.width - this.chart.getYLabelWidth()) * params.devicePixelRatio
      : this.chart.getYLabelWidth() * params.devicePixelRatio;
    canvas.height = params.height * params.devicePixelRatio;
    if (isMain) {
      this.context.scale(params.devicePixelRatio, params.devicePixelRatio);
    } else {
      this.axisContext.scale(params.devicePixelRatio, params.devicePixelRatio);
    }
  }

  public init(params: InitParams): void {
    this.extent = this.createExtent();
    this.container = document.createElement("div");
    this.container.style.overflow = "hidden";
    this.container.style.userSelect = "none";
    this.container.style.borderTop = `2px solid ${
      this.chart.getTheme().grid.color
    }`;
    // @ts-ignore
    this.container.style.webkitTapHighlightColor = "transparent";
    this.container.style.position = "absolute";
    this.container.style.left = params.x + "px";
    this.container.style.top = params.y + "px";
    this.container.style.width = params.width + "px";
    this.container.style.height = params.height + "px";
    this.canvas = document.createElement("canvas");
    this.axisCanvas = document.createElement("canvas");

    this.context = this.canvas.getContext("2d")!;
    this.axisContext = this.axisCanvas.getContext("2d")!;

    this.adjustCanvas(this.canvas, params, true);
    this.adjustCanvas(this.axisCanvas, params, false);

    this.container.appendChild(this.canvas);
    this.container.appendChild(this.axisCanvas);

    this.labelContainer.style.position = "relative";
    this.labelContainer.style.left = "5px";
    this.labelContainer.style.top = "10px";
    this.container.appendChild(this.labelContainer);
  }

  public resize(params: InitParams) {
    this.container.style.left = params.x + "px";
    this.container.style.top = params.y + "px";
    this.container.style.width = params.width + "px";
    this.container.style.height = params.height + "px";
    this.adjustCanvas(this.canvas, params, true);
    this.adjustCanvas(this.axisCanvas, params, false);
  }

  public getContainer() {
    return this.container;
  }

  public abstract getCrosshairValue(time: number, relativeY: number): string;

  protected initDrawing() {
    const ctx = this.context;
    ctx.clearRect(0, 0, this.width(), this.height());
    ctx.fillStyle = this.chart.getOptions().theme.backgroundColor;
    ctx.fillRect(0, 0, this.width(), this.height());

    ctx.lineWidth = this.chart.getOptions().theme.grid.width;
    ctx.strokeStyle = this.chart.getOptions().theme.grid.color;

    for (const x of this.chart.getLastXGridCoords()) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height());
      ctx.stroke();
    }

    this.initYAxis();
  }

  private initYAxis() {
    const ctx = this.axisContext;
    ctx.fillStyle = this.chart.getTheme().yAxis.backgroundColor;
    ctx.clearRect(0, 0, this.chart.getYLabelWidth(), this.height());
    ctx.fillRect(0, 0, this.chart.getYLabelWidth(), this.height());
    this.drawYAxis();
  }

  protected width() {
    return this.canvas.width / (window.devicePixelRatio || 1);
  }

  protected height() {
    return this.canvas.height / (window.devicePixelRatio || 1);
  }

  protected calculateYAxisLabels(fontSize: number, labelSpacing: number) {
    const textHeight = fontSize * 1.2; // Estimated height of text
    const canvasHeight = this.axisCanvas.height;

    let range = this.extent.getYMax() - this.extent.getYMin();
    range = Math.max(range, 0.0001); // Ensure a minimum range to avoid division by zero

    const maxPossibleLabels = Math.floor(
      canvasHeight / (textHeight + labelSpacing)
    );
    const stepSize = this.calculateStepSize(range, maxPossibleLabels);

    const firstLabel = Math.ceil(this.extent.getYMin() / stepSize) * stepSize;
    const labels: AxisLabel[] = [];

    for (
      let value = firstLabel;
      value <= this.extent.getYMax();
      value += stepSize
    ) {
      const position =
        canvasHeight - ((value - this.extent.getYMin()) / range) * canvasHeight;
      labels.push({ value: parseFloat(value.toFixed(10)), position });
    }

    return labels;
  }

  protected calculateStepSize(range: number, maxLabels: number) {
    // Step 1: Determine the initial raw step size
    let rawStep = range / maxLabels;

    // Step 2: Adjust for precision based on the range's magnitude
    let scale = Math.pow(10, Math.floor(Math.log10(rawStep)));
    let normalizedStep = rawStep / scale; // Normalize step size to [1, 10)

    // Step 3: Round to a nice value
    let roundedStep;
    if (normalizedStep < 1.5) {
      roundedStep = 1;
    } else if (normalizedStep < 3) {
      roundedStep = 2;
    } else if (normalizedStep < 7.5) {
      roundedStep = 5;
    } else {
      roundedStep = 10;
    }

    // Calculate final step size
    let stepSize = roundedStep * scale;

    // Step 4: Adjust decimal places for the step size to ensure precision
    let decimalPlaces = Math.max(-Math.floor(Math.log10(stepSize)), 0);
    return parseFloat(stepSize.toFixed(decimalPlaces));
  }

  protected drawYAxis(): void {
    const theme = this.chart.getTheme();
    const yAxisValues = this.calculateYAxisLabels(theme.xAxis.fontSize, 30);

    const ctx = this.axisContext;

    ctx.fillStyle = theme.yAxis.color;
    ctx.font =
      ctx.font = `${theme.yAxis.fontSize}px ${theme.xAxis.font}, monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i < yAxisValues.length; i++) {
      const value = yAxisValues[i];
      const y = value.position;
      if (y - theme.yAxis.fontSize < 0) continue;
      if (
        y + theme.yAxis.fontSize >
        this.axisCanvas.height / window.devicePixelRatio
      )
        continue;
      const text = this.chart.getFormatter().formatPrice(value.value);
      const textWidth = ctx.measureText(text).width;

      ctx.fillText(
        text,
        (ctx.canvas.width / window.devicePixelRatio - textWidth) / 2 +
          textWidth,
        y
      );
      const mainCtx = this.context;

      mainCtx.lineWidth = theme.grid.width;
      mainCtx.strokeStyle = theme.grid.color;
      mainCtx.beginPath();
      mainCtx.moveTo(0, y);
      mainCtx.lineTo(mainCtx.canvas.width, y);
      mainCtx.stroke();
    }
  }
}
