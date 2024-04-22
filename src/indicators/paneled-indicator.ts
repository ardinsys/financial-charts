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
    this.container = document.createElement("div");
    this.container.style.overflow = "hidden";
    this.container.style.userSelect = "none";
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
