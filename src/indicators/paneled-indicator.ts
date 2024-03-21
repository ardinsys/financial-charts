import { Indicator } from "..";

export interface InitParams {
  width: number;
  height: number;
  y: number;
  x: number;
  devicePixelRatio: number;
}

export abstract class PaneledIndicator<
  TTheme extends object,
  TOptions extends object
> extends Indicator<TTheme, TOptions> {
  protected container!: HTMLElement;
  protected canvas!: HTMLCanvasElement;
  protected axisCanvas!: HTMLCanvasElement;
  protected context!: CanvasRenderingContext2D;
  protected axisContext!: CanvasRenderingContext2D;

  private adjustCanvas(params: InitParams) {
    this.canvas.style.userSelect = "none";
    // @ts-ignore
    this.canvas.style.webkitTapHighlightColor = "transparent";
    this.canvas.style.position = "absolute";
    this.canvas.style.left = params.x + "px";
    this.canvas.style.top = params.y + "px";
    this.canvas.style.width = params.width - this.chart.getYLabelWidth() + "px";
    this.canvas.style.height = params.height + "px";
    this.canvas.width =
      (params.width - this.chart.getYLabelWidth()) * params.devicePixelRatio;
    this.canvas.height = params.height * params.devicePixelRatio;
    this.context = this.canvas.getContext("2d")!;
    this.context.scale(params.devicePixelRatio, params.devicePixelRatio);
  }

  private adjustYAxisCanvas(params: InitParams) {
    this.axisCanvas.style.userSelect = "none";
    // @ts-ignore
    this.axisCanvas.style.webkitTapHighlightColor = "transparent";
    this.axisCanvas.style.position = "absolute";
    this.axisCanvas.style.left = this.width() + "px";
    this.axisCanvas.style.top = params.y + "px";
    this.axisCanvas.style.width = this.chart.getYLabelWidth() + "px";
    this.axisCanvas.style.height = params.height + "px";
    this.axisCanvas.width =
      this.chart.getYLabelWidth() * params.devicePixelRatio;
    this.axisCanvas.height = params.height * params.devicePixelRatio;
    this.axisContext = this.axisCanvas.getContext("2d")!;
    this.axisContext.scale(params.devicePixelRatio, params.devicePixelRatio);
  }

  public init(params: InitParams): void {
    this.canvas = document.createElement("canvas");
    this.axisCanvas = document.createElement("canvas");
    this.adjustCanvas(params);
    this.adjustYAxisCanvas(params);
  }

  public resizeCanvases(params: InitParams) {
    this.adjustCanvas(params);
    this.context.scale(params.devicePixelRatio, params.devicePixelRatio);

    this.adjustYAxisCanvas(params);
    this.axisContext.scale(params.devicePixelRatio, params.devicePixelRatio);
  }

  public getCanvas() {
    return this.canvas;
  }

  public getYAxisCanvas() {
    return this.axisCanvas;
  }

  public abstract getCrosshairValue(time: number, relativeY: number): string;

  protected initMain() {
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
  }

  protected initYAxis() {
    const ctx = this.axisContext;
    ctx.fillStyle = this.chart.getOptions().theme.backgroundColor;
    ctx.clearRect(0, 0, this.chart.getYLabelWidth(), this.height());
    ctx.fillRect(0, 0, this.chart.getYLabelWidth(), this.height());
  }

  protected width() {
    return this.canvas.width / (window.devicePixelRatio || 1);
  }

  protected height() {
    return this.canvas.height / (window.devicePixelRatio || 1);
  }
}
