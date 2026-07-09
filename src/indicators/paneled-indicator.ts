import type { Pane } from "../panes/pane";
import { DataScaleModel } from "../scales/data-scale-model";
import {
  calculateStepSize as calculatePriceStepSize,
  calculateYAxisLabels as calculatePriceYAxisLabels
} from "../scales/ticks/price-ticks";
import type { ScaleProjectOptions } from "../scales/scale";
import type { BarAlignment } from "../scales/time-scale";
import {
  configurePositionedElement,
  createCanvasLayer,
  createPositionedContainer,
  resizeCanvasLayer
} from "../utils/dom";
import { pixelRatio } from "../utils/screen";
import {
  DefaultIndicatorOptions,
  Indicator,
  type IndicatorDrawingContext,
  type IndicatorPoint
} from "./indicator";

export interface InitParams {
  width: number;
  height: number;
  y: number;
  x: number;
  devicePixelRatio: number;
  pane?: Pane;
}

export interface PaneledIndicatorDrawingContext extends Omit<
  IndicatorDrawingContext,
  | "ctx"
  | "canvas"
  | "priceScale"
  | "scaleOptions"
  | "projectTime"
  | "projectPrice"
  | "projectPoint"
> {
  ctx: CanvasRenderingContext2D;
  axisCtx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  axisCanvas: HTMLCanvasElement;
  pane?: Pane;
  scale: DataScaleModel;
  priceScale: ReturnType<Pane["getPriceScale"]>;
  scaleOptions: ScaleProjectOptions & { barAlignment: BarAlignment };
  width: number;
  height: number;
  axisWidth: number;
  projectTime(time: number, barAlignment?: BarAlignment): number;
  projectPrice(value: number): number;
  projectPoint(
    time: number,
    value: number,
    barAlignment?: BarAlignment
  ): IndicatorPoint;
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
    const context = isMain ? this.context : this.axisContext;

    resizeCanvasLayer(canvas, {
      left: isMain ? 0 : mainWidth,
      top: 0,
      width: isMain ? mainWidth : axisWidth,
      height,
      pixelRatio: params.devicePixelRatio,
      context
    });
  }

  public init(params: InitParams): void {
    this.pane = params.pane;
    this.scale = this.createScale();
    this.container = createPositionedContainer({
      overflow: "hidden",
      userSelect: "none",
      tapHighlightColor: "transparent",
      borderTop: `2px solid ${this.chart.getTheme().grid.color}`,
      left: params.x,
      top: params.y,
      width: params.width,
      height: params.height
    });
    this.canvas = createCanvasLayer();
    this.axisCanvas = createCanvasLayer();

    this.context = this.canvas.getContext("2d")!;
    this.axisContext = this.axisCanvas.getContext("2d")!;

    this.adjustCanvas(this.canvas, params, true);
    this.adjustCanvas(this.axisCanvas, params, false);

    this.container.appendChild(this.canvas);
    this.container.appendChild(this.axisCanvas);

    configurePositionedElement(this.labelContainer, {
      position: "relative",
      left: 5,
      top: 10
    });
    this.container.appendChild(this.labelContainer);
  }

  public resize(params: InitParams) {
    this.pane = params.pane;
    configurePositionedElement(this.container, {
      left: params.x,
      top: params.y,
      width: params.width,
      height: params.height
    });
    this.adjustCanvas(this.canvas, params, true);
    this.adjustCanvas(this.axisCanvas, params, false);
  }

  public getContainer() {
    return this.container;
  }

  public abstract getCrosshairValue(time: number, relativeY: number): string;

  public draw(): void {
    this.initDrawing();
    if (!this.visible) return;
    this.drawPane(this.getPaneDrawingContext());
  }

  protected drawPane(_context: PaneledIndicatorDrawingContext): void {}

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

  protected getPaneDrawingContext(): PaneledIndicatorDrawingContext {
    const base = this.getDrawingContext();
    const canvas = this.canvas;
    const paneRegion = this.pane?.getRegion();
    const yAxisRegion = this.pane?.getYAxisRegion();
    const timeScale = this.chart.getTimeScale();
    const priceScale = this.pane?.getPriceScale() ?? this.chart.getPriceScale();
    const scaleOptions = {
      canvas,
      barAlignment: "center" as const
    };

    return {
      ...base,
      ctx: this.context,
      axisCtx: this.axisContext,
      canvas,
      axisCanvas: this.axisCanvas,
      pane: this.pane,
      scale: this.scale,
      priceScale,
      scaleOptions,
      width: paneRegion?.width ?? this.width(),
      height: paneRegion?.height ?? this.height(),
      axisWidth: yAxisRegion?.width ?? this.axisCanvas.width / pixelRatio(),
      projectTime: (time, barAlignment = "center") =>
        timeScale.project(time, { canvas, barAlignment }),
      projectPrice: (value) => priceScale.project(value, scaleOptions),
      projectPoint: (time, value, barAlignment = "center") => ({
        x: timeScale.project(time, { canvas, barAlignment }),
        y: priceScale.project(value, scaleOptions)
      })
    };
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
      return this.pane.calculateYAxisLabels(this.scale, fontSize, labelSpacing);
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
