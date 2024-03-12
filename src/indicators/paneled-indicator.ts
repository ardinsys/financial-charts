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
  protected context!: CanvasRenderingContext2D;

  private adjustCanvas(params: InitParams) {
    this.canvas.style.userSelect = "none";
    // @ts-ignore
    this.canvas.style.webkitTapHighlightColor = "transparent";
    this.canvas.style.position = "absolute";
    this.canvas.style.left = params.x + "px";
    this.canvas.style.top = params.y + "px";
    this.canvas.style.width = params.width + "px";
    this.canvas.style.height = params.height + "px";
    this.canvas.width = params.width * params.devicePixelRatio;
    this.canvas.height = params.height * params.devicePixelRatio;
    this.context = this.canvas.getContext("2d")!;
    this.context.scale(params.devicePixelRatio, params.devicePixelRatio);
  }

  public init(params: InitParams): void {
    this.canvas = document.createElement("canvas");
    this.adjustCanvas(params);
  }

  public resizeCanvas(params: InitParams) {
    const img = this.context.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    this.adjustCanvas(params);
    this.context.scale(params.devicePixelRatio, params.devicePixelRatio);
    this.context.putImageData(img, 0, 0);
  }

  public getCanvas() {
    return this.canvas;
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
    const ctx = this.context;
    ctx.fillStyle = this.chart.getOptions().theme.backgroundColor;
    ctx.clearRect(
      this.width() - this.chart.getYLabelWidth(),
      0,
      this.chart.getYLabelWidth(),
      this.height()
    );
    ctx.fillRect(
      this.width() - this.chart.getYLabelWidth(),
      0,
      this.chart.getYLabelWidth(),
      this.height()
    );
  }

  protected width() {
    return this.canvas.width / (window.devicePixelRatio || 1);
  }

  protected height() {
    return this.canvas.height / (window.devicePixelRatio || 1);
  }
}
