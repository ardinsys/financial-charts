import type { Pane } from "../panes/pane";
import { DataScaleModel } from "../scales/data-scale-model";
import {
  calculateStepSize as calculatePriceStepSize,
  calculateYAxisLabels as calculatePriceYAxisLabels
} from "../scales/ticks/price-ticks";
import { pixelRatio } from "../utils/screen";
import { DefaultIndicatorOptions, Indicator } from "./indicator";

export interface InitParams {
  width: number;
  height: number;
  y: number;
  x: number;
  devicePixelRatio: number;
  pane?: Pane;
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
  protected scale!: DataScaleModel;
  protected pane?: Pane;

  public abstract createScale(): DataScaleModel;

  private adjustCanvas(
    canvas: HTMLCanvasElement,
    params: InitParams,
    isMain: boolean
  ) {
    const paneRegion = params.pane?.getRegion();
    const yAxisRegion = params.pane?.getYAxisRegion();
    const mainWidth =
      paneRegion?.width ?? params.width - this.chart.getYLabelWidth();
    const axisWidth = yAxisRegion?.width ?? this.chart.getYLabelWidth();
    const height = paneRegion?.height ?? params.height;

    canvas.style.userSelect = "none";
    // @ts-ignore
    canvas.style.webkitTapHighlightColor = "transparent";
    canvas.style.position = "absolute";
    canvas.style.left = isMain ? "0px" : mainWidth + "px";
    canvas.style.top = "0px";
    canvas.style.width = (isMain ? mainWidth : axisWidth) + "px";
    canvas.style.height = height + "px";
    canvas.width = (isMain ? mainWidth : axisWidth) * params.devicePixelRatio;
    canvas.height = height * params.devicePixelRatio;
    if (isMain) {
      this.context.scale(params.devicePixelRatio, params.devicePixelRatio);
    } else {
      this.axisContext.scale(params.devicePixelRatio, params.devicePixelRatio);
    }
  }

  public init(params: InitParams): void {
    this.pane = params.pane;
    this.scale = this.createScale();
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
    this.pane = params.pane;
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
    this.pane?.setPriceRange(this.scale.getYMin(), this.scale.getYMax());

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
    ctx.clearRect(
      0,
      0,
      this.chart.getYLabelWidth() / pixelRatio(),
      this.height()
    );
    ctx.fillRect(
      0,
      0,
      this.chart.getYLabelWidth() / pixelRatio(),
      this.height()
    );
    this.drawYAxis();
  }

  protected width() {
    return this.canvas.width / pixelRatio();
  }

  protected height() {
    return this.canvas.height / pixelRatio();
  }

  protected calculateYAxisLabels(fontSize: number, labelSpacing: number) {
    if (this.pane) {
      return this.pane.calculateYAxisLabels(
        this.scale,
        fontSize,
        labelSpacing
      );
    }

    return calculatePriceYAxisLabels({
      yMin: this.scale.getYMin(),
      yMax: this.scale.getYMax(),
      canvasHeight: this.axisCanvas.height / pixelRatio(),
      fontSize,
      labelSpacing
    });
  }

  protected calculateStepSize(range: number, maxLabels: number) {
    if (this.pane) {
      return this.pane.calculateStepSize(range, maxLabels);
    }

    return calculatePriceStepSize(range, maxLabels);
  }

  protected drawYAxis(): void {
    if (this.pane) {
      this.pane.drawYAxis({
        axisContext: this.axisContext,
        gridContext: this.context,
        scale: this.scale,
        theme: this.chart.getTheme(),
        formatter: this.chart.getFormatter(),
        pixelRatio: pixelRatio(),
        labelSpacing: 30
      });
      return;
    }

    const theme = this.chart.getTheme();
    const yAxisValues = this.calculateYAxisLabels(theme.xAxis.fontSize, 30);

    const ctx = this.axisContext;
    const ratio = pixelRatio();

    ctx.fillStyle = theme.yAxis.color;
    ctx.font =
      ctx.font = `${theme.yAxis.fontSize}px ${theme.xAxis.font}, monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i < yAxisValues.length; i++) {
      const value = yAxisValues[i];
      const y = value.position;
      if (y - theme.yAxis.fontSize < 0) continue;
      if (y + theme.yAxis.fontSize > this.axisCanvas.height / ratio) continue;
      const text = this.chart.getFormatter().formatPrice(value.value);
      const textWidth = ctx.measureText(text).width;

      ctx.fillText(
        text,
        (ctx.canvas.width / ratio - textWidth) / 2 + textWidth,
        y
      );
      const mainCtx = this.context;

      mainCtx.lineWidth = theme.grid.width;
      mainCtx.strokeStyle = theme.grid.color;
      mainCtx.beginPath();
      mainCtx.moveTo(0, y);
      mainCtx.lineTo(mainCtx.canvas.width / ratio, y);
      mainCtx.stroke();
    }
  }
}
