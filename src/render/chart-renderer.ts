import type { PriceAxisAnnotation } from "../annotations/price-axis-annotation";
import { renderPriceAxisAnnotations } from "../annotations/price-axis-annotation";
import type { ResolvedChartOptions } from "../chart/chart-options";
import type { ChartData, ChartDataValueKey, TimeRange } from "../chart/types";
import type {
  ChartController,
  ChartControllerDrawingContext
} from "../controllers/controller";
import type { Indicator } from "../indicators/indicator";
import type { PaneledIndicator } from "../indicators/paneled-indicator";
import type { Pane } from "../panes/pane";
import type { ChartCrosshairState } from "../interaction/crosshair";
import type { DataScaleModel } from "../scales/data-scale-model";
import type {
  BarAlignment,
  TimeScale,
  TimeScaleRange
} from "../scales/time-scale";
import {
  calculateYAxisLabels as calculatePriceYAxisLabels
} from "../scales/ticks/price-ticks";
import { TimeTickGenerator } from "../scales/ticks/time-ticks";
import {
  bindEvent,
  createCanvasLayer,
  resizeCanvasLayer,
  scaleCanvasContext
} from "../utils/dom";
import { pixelRatio } from "../utils/screen";
import {
  RenderPipeline,
  type RenderCallback,
  type RenderLayer,
  type RenderStage
} from "./render-pipeline";
import type { ChartCanvasLayer, ChartRedrawPart } from "./chart-render-types";

type ChartOwnedCanvasLayer = ChartCanvasLayer | "annotations";

interface ChartRendererLayout {
  readonly plotWidth: number;
  readonly plotHeight: number;
  readonly paneLayoutHeight: number;
  readonly yAxisWidth: number;
  readonly yAxisHeight: number;
  readonly fullWidth: number;
  readonly fullHeight: number;
  readonly xAxisHeight: number;
}

interface ChartRenderModel {
  getOptions(): ResolvedChartOptions;
  hasData(): boolean;
  getTimes(): readonly number[];
  getVisibleData(): readonly ChartData[];
  getVisibleIndexRange(): TimeScaleRange;
  getTimeRange(): TimeRange;
  getTimeScale(): TimeScale;
  getVisibleScale(): DataScaleModel;
  getTimeAnchorAlignment(): BarAlignment;
  getPixelsPerBar(): number;
  getController(): ChartController;
  getIndicators(): readonly Indicator<any, any>[];
  getPaneledIndicators(): readonly PaneledIndicator<any, any>[];
  getPanes(): readonly Pane[];
  getMainPane(): Pane;
  getPaneIndicator(pane: Pane): PaneledIndicator<any, any> | undefined;
  getPriceAxisAnnotations(): Iterable<PriceAxisAnnotation>;
  getCrosshairState(): ChartCrosshairState | undefined;
  shouldDrawCrosshair(): boolean;
  refreshIndicatorLabels(time?: number): void;
  beforeDraw(): void;
  drawPlugins(): void;
  afterDraw(): void;
}

interface ChartRendererOptions {
  getLayout(): ChartRendererLayout;
  onResize(): void;
}

const canvasLayers: readonly ChartOwnedCanvasLayer[] = [
  "main",
  "crosshair",
  "x-label",
  "y-label",
  "indicator",
  "drawings",
  "annotations"
];

const crosshairLabelIndex: Record<ChartDataValueKey, number> = {
  open: 0,
  high: 1,
  low: 2,
  close: 3,
  volume: 4
};

export class ChartRenderer {
  private readonly canvases = new Map<
    ChartOwnedCanvasLayer,
    HTMLCanvasElement
  >();
  private readonly contexts = new Map<
    ChartOwnedCanvasLayer,
    CanvasRenderingContext2D
  >();
  private readonly pipeline = new RenderPipeline();
  private readonly timeTickGenerator = new TimeTickGenerator();
  private readonly pendingLayers = new Set<RenderLayer>();
  private readonly resizeObserver: ResizeObserver;
  private readonly disposeWindowResize: () => void;
  private frame?: number;
  private paused = false;
  private stopped = false;
  private disposed = false;
  private skipObservedResize = false;
  private devicePixelRatio = pixelRatio();
  private lastXGridCoords: readonly number[] = Object.freeze([]);

  constructor(
    private readonly container: HTMLElement,
    private readonly model: ChartRenderModel,
    private readonly options: ChartRendererOptions
  ) {
    for (const layer of canvasLayers) this.getOwnedCanvas(layer);
    this.configurePipeline();
    this.disposeWindowResize = bindEvent(window, "resize", () => {
      const nextRatio = pixelRatio();
      if (nextRatio === this.devicePixelRatio) return;
      this.devicePixelRatio = nextRatio;
      this.options.onResize();
      this.skipObservedResize = true;
    });
    this.resizeObserver = new ResizeObserver(() => {
      if (this.skipObservedResize) {
        this.skipObservedResize = false;
        return;
      }
      this.options.onResize();
    });
    this.resizeObserver.observe(container);
  }

  getCanvas(layer: ChartCanvasLayer): HTMLCanvasElement {
    return this.getOwnedCanvas(layer);
  }

  getContext(layer: ChartCanvasLayer): CanvasRenderingContext2D {
    return this.getOwnedContext(layer);
  }

  getLogicalSize(layer: ChartCanvasLayer): { width: number; height: number } {
    return this.getOwnedLogicalSize(layer);
  }

  getDrawingSize(): { width: number; height: number } {
    return this.getLogicalSize("main");
  }

  getFullSize(): { width: number; height: number } {
    return this.getLogicalSize("crosshair");
  }

  getDrawingContext(): ChartControllerDrawingContext {
    const canvasContext = this.getContext("main");
    const scaleOptions = { canvas: canvasContext.canvas };
    const timeScale = this.model.getTimeScale();
    const priceScale = this.model.getVisibleScale().getPriceScale();
    return {
      canvasContext,
      logicalSize: this.getLogicalSize("main"),
      visibleData: this.model.getVisibleData(),
      timeRange: this.model.getTimeRange(),
      pixelsPerBar: this.model.getPixelsPerBar(),
      projectTime: (time) => timeScale.project(time, scaleOptions),
      projectPrice: (price) => priceScale.project(price, scaleOptions)
    };
  }

  getLastXGridCoords(): readonly number[] {
    return this.lastXGridCoords;
  }

  resetDerivedState(): void {
    this.lastXGridCoords = Object.freeze([]);
  }

  resizeCanvases(): void {
    for (const [layer, canvas] of this.canvases) {
      this.resizeCanvas(layer, canvas);
    }
  }

  onRenderStage(stage: RenderStage, callback: RenderCallback): () => void {
    return this.pipeline.addHook(stage, callback);
  }

  requestRedraw(
    part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>,
    immediate = false
  ): void {
    if (this.stopped) return;
    const parts = Array.isArray(part) ? part : [part];
    for (const layer of parts) this.pendingLayers.add(layer);
    if (this.paused) return;

    if (immediate) {
      this.cancelFrame();
      this.flush();
      if (this.pendingLayers.size > 0) this.scheduleFrame();
      return;
    }
    this.scheduleFrame();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused && this.pendingLayers.size > 0) this.scheduleFrame();
  }

  private calculateYAxisLabels(labelSpacing: number) {
    const options = this.model.getOptions();
    const scale = this.model.getVisibleScale();
    return calculatePriceYAxisLabels({
      yMin: scale.getYMin(),
      yMax: scale.getYMax(),
      canvasHeight: this.getLogicalSize("y-label").height,
      fontSize: options.theme.yAxis.fontSize,
      labelSpacing
    });
  }

  estimatePriceLabelDecimalPlaces(labelSpacing: number): number {
    const labels = this.calculateYAxisLabels(labelSpacing);
    let stepSize = Infinity;

    for (let index = 1; index < labels.length; index++) {
      const step = Math.abs(labels[index].value - labels[index - 1].value);
      if (step > 0) stepSize = Math.min(stepSize, step);
    }
    if (!Number.isFinite(stepSize)) return 0;

    for (let decimals = 0; decimals <= 6; decimals++) {
      const scaledStep = stepSize * 10 ** decimals;
      if (Math.abs(Math.round(scaledStep) - scaledStep) < 1e-8) {
        return decimals;
      }
    }
    return 6;
  }

  private drawXAxis(): void {
    const ctx = this.getContext("x-label");
    const size = this.getLogicalSize("x-label");
    const theme = this.model.getOptions().theme.xAxis;

    ctx.fillStyle = theme.backgroundColor;
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.strokeStyle = theme.separatorColor;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size.width, 0);
    ctx.stroke();
    ctx.fillStyle = theme.color;
    ctx.font = `${theme.fontSize}px ${theme.font}, monospace`;
    ctx.textBaseline = "middle";

    const labels = this.getXAxisLabels(ctx);
    this.lastXGridCoords = Object.freeze(labels.map((label) => label.x));
    for (const label of labels) {
      ctx.fillText(label.label, label.start, size.height - 15);
    }
  }

  private drawYAxis(): void {
    const values = this.calculateYAxisLabels(30);
    const ctx = this.getContext("y-label");
    const size = this.getLogicalSize("y-label");
    const { theme, formatter } = this.model.getOptions();

    ctx.fillStyle = theme.yAxis.backgroundColor;
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.fillStyle = theme.yAxis.color;
    ctx.font = `${theme.yAxis.fontSize}px ${theme.xAxis.font}, monospace`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (const value of values) {
      const y = value.position;
      if (y - theme.yAxis.fontSize < 0) continue;
      if (y + theme.yAxis.fontSize > size.height) continue;
      const text = formatter.formatPrice(value.value);
      const textWidth = ctx.measureText(text).width;
      ctx.fillText(text, (size.width - textWidth) / 2 + textWidth, y);
    }
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.cancelFrame();
    this.pendingLayers.clear();
    this.disposeWindowResize();
    this.resizeObserver.unobserve(this.container);
    this.resizeObserver.disconnect();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.pipeline.clear();
    for (const canvas of this.canvases.values()) canvas.remove();
    this.canvases.clear();
    this.contexts.clear();
  }

  private configurePipeline(): void {
    this.pipeline.addHook("beforeDraw", () => this.model.beforeDraw());
    this.pipeline.addHook("grid", () => this.drawGrid());
    this.pipeline.addHook("axes", () => this.drawAxes());
    this.pipeline.addHook("series", () => this.drawSeries());
    this.pipeline.addHook("indicators", () => this.drawIndicators());
    this.pipeline.addHook("drawings", () => this.model.drawPlugins());
    this.pipeline.addHook("annotations", () => this.drawAnnotations());
    this.pipeline.addHook("crosshair", () => this.drawCrosshair());
    this.pipeline.addHook("afterDraw", () => this.model.afterDraw());
  }

  private drawGrid(): void {
    const main = this.getContext("main");
    const mainSize = this.getLogicalSize("main");
    const options = this.model.getOptions();
    main.clearRect(0, 0, mainSize.width, mainSize.height);
    main.fillStyle = options.theme.backgroundColor;
    main.fillRect(0, 0, mainSize.width, mainSize.height);
    if (!this.model.hasData()) return;

    const yAxisSize = this.getLogicalSize("y-label");
    main.lineWidth = options.theme.grid.width;
    main.strokeStyle = options.theme.grid.color;
    for (const value of this.calculateYAxisLabels(30)) {
      const y = value.position;
      if (y - options.theme.yAxis.fontSize < 0) continue;
      if (y + options.theme.yAxis.fontSize > yAxisSize.height) continue;
      main.beginPath();
      main.moveTo(0, y);
      main.lineTo(mainSize.width, y);
      main.stroke();
    }

    const xAxis = this.getContext("x-label");
    xAxis.font = `${options.theme.xAxis.fontSize}px ${options.theme.xAxis.font}, monospace`;
    const xGridCoords: number[] = [];
    for (const label of this.getXAxisLabels(xAxis)) {
      main.beginPath();
      main.moveTo(label.x, 0);
      main.lineTo(label.x, mainSize.height);
      main.stroke();
      xGridCoords.push(label.x);
    }
    this.lastXGridCoords = Object.freeze(xGridCoords);
  }

  private drawAxes(): void {
    if (!this.model.hasData()) {
      for (const layer of ["x-label", "y-label"] as const) {
        const context = this.getContext(layer);
        const size = this.getLogicalSize(layer);
        context.clearRect(0, 0, size.width, size.height);
      }
      return;
    }
    this.drawYAxis();
    this.drawXAxis();
  }

  private drawSeries(): void {
    if (!this.model.hasData()) return;
    if (this.model.getOptions().volume) this.drawVolumeBars();
    this.model.getController().draw();
  }

  private drawVolumeBars(): void {
    const ctx = this.getContext("main");
    const pixelsPerBar = this.model.getPixelsPerBar();
    const spacing = pixelsPerBar * 0.1;
    const width = pixelsPerBar - spacing;
    const options = this.model.getOptions();
    const timeRange = this.model.getTimeRange();
    const timeScale = this.model.getTimeScale();
    const volumeScale = this.model.getVisibleScale().getVolumeScale();
    const scaleOptions = {
      canvas: ctx.canvas,
      barAlignment: "edge" as const
    };

    ctx.lineWidth = Math.min(1, width / 5);
    for (const point of this.model.getVisibleData()) {
      if (point.time < timeRange.start) continue;
      if (point.time > timeRange.end) break;
      const x = timeScale.project(point.time, scaleOptions);
      const height = volumeScale.projectVolume(point.volume!, scaleOptions);
      ctx.beginPath();
      ctx.fillStyle =
        point.close! > point.open!
          ? options.theme.volume.upColor
          : options.theme.volume.downColor;
      ctx.rect(
        x + spacing / 2,
        this.getDrawingSize().height - height,
        width,
        height
      );
      ctx.fill();
    }
  }

  private drawIndicators(): void {
    const context = this.getContext("indicator");
    const size = this.getLogicalSize("indicator");
    context.clearRect(0, 0, size.width, size.height);

    if (!this.model.hasData()) {
      for (const indicator of this.model.getPaneledIndicators()) {
        indicator.clearDrawing();
      }
      return;
    }
    for (const indicator of this.model.getIndicators()) indicator.draw();
    for (const indicator of this.model.getPaneledIndicators()) indicator.draw();
  }

  private drawAnnotations(): void {
    const context = this.getOwnedContext("annotations");
    const size = this.getOwnedLogicalSize("annotations");
    const options = this.model.getOptions();
    renderPriceAxisAnnotations({
      context,
      width: size.width,
      height: size.height,
      panes: this.model.getPanes(),
      annotations: this.model.getPriceAxisAnnotations(),
      theme: options.theme,
      formatter: options.formatter
    });
  }

  private drawCrosshair(): void {
    const context = this.getContext("crosshair");
    const size = this.getLogicalSize("crosshair");
    context.clearRect(0, 0, size.width, size.height);

    const state = this.model.getCrosshairState();
    if (!state || !this.model.shouldDrawCrosshair()) return;
    const layout = this.options.getLayout();
    if (state.y >= layout.paneLayoutHeight) return;

    const options = this.model.getOptions();
    const x = this.model.getTimeScale().project(state.time, {
      canvas: this.getContext("main").canvas,
      barAlignment: this.model.getTimeAnchorAlignment()
    });
    context.strokeStyle = options.theme.crosshair.color;
    context.lineWidth = options.theme.crosshair.width;
    context.setLineDash(options.theme.crosshair.lineDash);
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, layout.paneLayoutHeight);
    context.moveTo(0, state.y);
    context.lineTo(this.getDrawingSize().width, state.y);
    context.stroke();

    const text = options.formatter.formatTooltipDate(state.time);
    const textPadding = 10;
    const textWidth = context.measureText(text).width;
    const rectWidth = textWidth + textPadding * 2;
    const maxRectX = this.getFullSize().width - rectWidth;
    const rectX = Math.min(
      Math.max(x - textWidth / 2 - textPadding, 0),
      maxRectX
    );
    const textX = Math.min(
      Math.max(x - textWidth / 2, textPadding),
      maxRectX + textPadding
    );

    context.fillStyle = options.theme.crosshair.tooltip.backgroundColor;
    context.rect(
      rectX,
      layout.paneLayoutHeight,
      rectWidth,
      textPadding * 2 + 12
    );

    const price = this.model
      .getVisibleScale()
      .pixelToPoint(0, state.y, this.getContext("main").canvas).price;
    const decimals = this.estimatePriceLabelDecimalPlaces(30);
    const paneIndicator = this.model.getPaneIndicator(state.pane);
    const priceText =
      state.pane === this.model.getMainPane() || !paneIndicator
        ? options.formatter.formatTooltipPrice(price, decimals)
        : paneIndicator.getCrosshairValue(
            state.time,
            state.pane.getRelativeY(state.y)
          );
    const priceRectWidth = this.getLogicalSize("y-label").width;
    const priceRectX = this.toLogical(context.canvas.width) - priceRectWidth;
    const priceTextX = priceRectX + 10;
    context.rect(
      priceRectX,
      Math.max(state.y - textPadding / 2 - 6, 1 + textPadding / 2 - 6),
      priceRectWidth,
      textPadding + 12
    );
    context.fill();

    context.font = `${options.theme.crosshair.tooltip.fontSize}px ${options.theme.crosshair.tooltip.font}, monospace`;
    context.fillStyle = options.theme.crosshair.tooltip.color;
    context.fillText(
      text,
      textX,
      layout.paneLayoutHeight + textPadding * 2
    );
    context.fillText(
      priceText,
      priceTextX,
      Math.max(state.y + textPadding / 2, textPadding + 6)
    );

    context.font = `${options.theme.crosshair.infoLine.fontSize}px ${options.theme.crosshair.infoLine.font}, monospace`;
    const labels =
      options.theme.crosshair.infoLine.labels[options.locale] ||
      options.theme.crosshair.infoLine.labels["*"];
    let infoX = 10;
    for (const key of this.model.getController().getCrosshairValues()) {
      if (key === "volume" && !options.volume) continue;
      const value = state.dataPoint[key];
      if (value == undefined) continue;
      const valueText =
        key === "volume"
          ? options.formatter.formatVolume(value, state.dataPoint.close ?? 1)
          : options.formatter.formatTooltipPrice(value, decimals);
      const label = labels[crosshairLabelIndex[key]];
      const labelWidth = context.measureText(label).width;
      const valueWidth = context.measureText(valueText).width;
      if (infoX + labelWidth + valueWidth > this.getDrawingSize().width) break;

      context.fillStyle = options.theme.crosshair.infoLine.color;
      context.fillText(
        label,
        infoX,
        options.theme.crosshair.tooltip.fontSize + 10
      );
      infoX += labelWidth;
      if (
        state.dataPoint.open != undefined &&
        state.dataPoint.close != undefined
      ) {
        context.fillStyle =
          state.dataPoint.open > state.dataPoint.close
            ? options.theme.crosshair.infoLine.downColor
            : options.theme.crosshair.infoLine.upColor;
      }
      context.fillText(
        valueText,
        infoX,
        options.theme.crosshair.tooltip.fontSize + 10
      );
      infoX += valueWidth + 10;
    }
    this.model.refreshIndicatorLabels(state.time);
  }

  private getXAxisLabels(ctx: CanvasRenderingContext2D) {
    const canvasWidth = this.getOwnedCanvas("main").width;
    const logicalCanvasWidth = this.toLogical(canvasWidth);
    const options = this.model.getOptions();
    const labels = this.timeTickGenerator.generate({
      times: this.model.getTimes(),
      visibleRange: this.model.getVisibleIndexRange(),
      formatter: options.formatter,
      targetTickCount: Math.max(2, Math.floor(logicalCanvasWidth / 90))
    });
    const occupied: { start: number; end: number }[] = [];
    const visible: Array<{ label: string; x: number; start: number }> = [];
    labels.sort((left, right) => right.priority - left.priority);

    for (const label of labels) {
      const x = this.model.getTimeScale().project(label.time, {
        canvas: { width: canvasWidth, height: 0 },
        barAlignment: this.model.getTimeAnchorAlignment()
      });
      const textWidth = ctx.measureText(label.label).width;
      const bounds = { start: x - textWidth / 2, end: x + textWidth / 2 };
      const overlaps = occupied.some(
        (drawn) => bounds.start < drawn.end + 20 && bounds.end > drawn.start - 20
      );
      if (!overlaps && bounds.end < logicalCanvasWidth) {
        if (bounds.start >= 0) {
          visible.push({ label: label.label, x, start: bounds.start });
        }
        occupied.push(bounds);
      }
    }
    return visible;
  }

  private getOwnedCanvas(layer: ChartOwnedCanvasLayer): HTMLCanvasElement {
    const existing = this.canvases.get(layer);
    if (existing) return existing;

    const canvas = createCanvasLayer();
    canvas.style.zIndex =
      layer === "crosshair"
        ? "100"
        : layer === "annotations"
          ? "70"
          : layer === "drawings"
            ? "60"
            : layer === "indicator"
              ? "50"
              : "1";
    if (layer === "crosshair") canvas.style.touchAction = "pan-x";
    this.container.appendChild(canvas);
    this.canvases.set(layer, canvas);
    this.resizeCanvas(layer, canvas);
    return canvas;
  }

  private getOwnedContext(
    layer: ChartOwnedCanvasLayer
  ): CanvasRenderingContext2D {
    const existing = this.contexts.get(layer);
    if (existing) return existing;
    const context = this.getOwnedCanvas(layer).getContext("2d")!;
    scaleCanvasContext(context);
    this.contexts.set(layer, context);
    return context;
  }

  private getOwnedLogicalSize(layer: ChartOwnedCanvasLayer) {
    const canvas = this.getOwnedContext(layer).canvas;
    return {
      width: this.toLogical(canvas.width),
      height: this.toLogical(canvas.height)
    };
  }

  private resizeCanvas(
    layer: ChartOwnedCanvasLayer,
    canvas: HTMLCanvasElement
  ): void {
    const layout = this.options.getLayout();
    let width = layout.plotWidth;
    let height = layout.plotHeight;
    let right: number | undefined;
    let bottom: number | undefined;

    if (layer === "y-label") {
      width = layout.yAxisWidth;
      height = layout.yAxisHeight;
      right = 0;
    } else if (layer === "annotations" || layer === "drawings") {
      width = layer === "annotations" ? layout.fullWidth : layout.plotWidth;
      height = layout.paneLayoutHeight;
    } else if (layer === "x-label" || layer === "crosshair") {
      width = layout.fullWidth;
      height = layer === "x-label" ? layout.xAxisHeight : layout.fullHeight;
      if (layer === "x-label") bottom = 0;
    }

    resizeCanvasLayer(canvas, {
      right,
      bottom,
      width,
      height,
      pixelRatio: this.devicePixelRatio,
      context: this.contexts.get(layer)
    });
  }

  private toLogical(value: number): number {
    return value / this.devicePixelRatio;
  }

  private scheduleFrame(): void {
    if (this.frame !== undefined || this.paused || this.stopped) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.flush();
      if (this.pendingLayers.size > 0) this.scheduleFrame();
    });
  }

  private cancelFrame(): void {
    if (this.frame === undefined) return;
    cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }

  private flush(): void {
    if (this.pendingLayers.size === 0 || this.paused || this.stopped) return;
    const layers = new Set(this.pendingLayers);
    this.pendingLayers.clear();
    this.pipeline.render(layers);
  }
}
