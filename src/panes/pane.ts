import type { Formatter } from "../chart/formatter";
import type { ResolvedChartTheme } from "../chart/themes";
import type { DataScaleModel } from "../scales/data-scale-model";
import { PriceScale } from "../scales/price-scale";
import {
  calculateStepSize as calculatePriceStepSize,
  calculateYAxisLabels as calculatePriceYAxisLabels
} from "../scales/ticks/price-ticks";
import type { BarAlignment, TimeScale } from "../scales/time-scale";

export interface PaneRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaneDrawable {
  zIndex?: number;
  draw(): void;
}

export interface PaneYAxisRenderOptions {
  axisContext: CanvasRenderingContext2D;
  gridContext: CanvasRenderingContext2D;
  scale: DataScaleModel;
  theme: ResolvedChartTheme;
  formatter: Formatter;
  pixelRatio: number;
  labelSpacing: number;
}

export class Pane {
  private region: PaneRegion = { x: 0, y: 0, width: 0, height: 0 };
  private yAxisRegion: PaneRegion = { x: 0, y: 0, width: 0, height: 0 };
  private readonly priceScale = new PriceScale({ min: 0, max: 1 });
  private timeScale?: TimeScale;
  private timeAnchorAlignment: BarAlignment = "center";
  private readonly drawables = new Set<PaneDrawable>();

  constructor(private readonly id: number) {}

  getId() {
    return this.id;
  }

  setRegion(region: PaneRegion) {
    this.region = region;
  }

  getRegion() {
    return this.region;
  }

  setYAxisRegion(region: PaneRegion) {
    this.yAxisRegion = region;
  }

  getYAxisRegion() {
    return this.yAxisRegion;
  }

  containsY(y: number) {
    return y >= this.region.y && y < this.region.y + this.region.height;
  }

  getRelativeY(y: number) {
    return y - this.region.y;
  }

  setTimeScale(timeScale: TimeScale) {
    this.timeScale = timeScale;
  }

  getTimeScale() {
    return this.timeScale;
  }

  setTimeAnchorAlignment(alignment: BarAlignment) {
    this.timeAnchorAlignment = alignment;
  }

  getTimeAnchorAlignment() {
    return this.timeAnchorAlignment;
  }

  getPriceScale() {
    return this.priceScale;
  }

  setPriceRange(min: number, max: number) {
    this.priceScale.setRange({ min, max });
  }

  addDrawable(drawable: PaneDrawable) {
    this.drawables.add(drawable);
  }

  removeDrawable(drawable: PaneDrawable) {
    this.drawables.delete(drawable);
  }

  draw() {
    for (const drawable of this.getDrawables()) {
      drawable.draw();
    }
  }

  getDrawables() {
    return [...this.drawables].sort((a, b) => {
      return (a.zIndex ?? 0) - (b.zIndex ?? 0);
    });
  }

  calculateYAxisLabels(
    scale: DataScaleModel,
    fontSize: number,
    labelSpacing: number
  ) {
    return calculatePriceYAxisLabels({
      yMin: scale.getYMin(),
      yMax: scale.getYMax(),
      canvasHeight: this.region.height,
      fontSize,
      labelSpacing
    });
  }

  calculateStepSize(range: number, maxLabels: number) {
    return calculatePriceStepSize(range, maxLabels);
  }

  drawYAxis({
    axisContext,
    gridContext,
    scale,
    theme,
    formatter,
    pixelRatio,
    labelSpacing
  }: PaneYAxisRenderOptions) {
    const yAxisValues = this.calculateYAxisLabels(
      scale,
      theme.yAxis.fontSize,
      labelSpacing
    );

    axisContext.fillStyle = theme.yAxis.backgroundColor;
    axisContext.clearRect(0, 0, this.yAxisRegion.width, this.region.height);
    axisContext.fillRect(0, 0, this.yAxisRegion.width, this.region.height);

    axisContext.fillStyle = theme.yAxis.color;
    axisContext.font = `${theme.yAxis.fontSize}px ${theme.xAxis.font}, monospace`;
    axisContext.textAlign = "right";
    axisContext.textBaseline = "middle";

    for (let i = 0; i < yAxisValues.length; i++) {
      const value = yAxisValues[i];
      const y = value.position;
      if (y - theme.yAxis.fontSize < 0) continue;
      if (y + theme.yAxis.fontSize > this.region.height) continue;
      const text = formatter.formatPrice(value.value);
      const textWidth = axisContext.measureText(text).width;

      axisContext.fillText(
        text,
        (axisContext.canvas.width / pixelRatio - textWidth) / 2 + textWidth,
        y
      );

      gridContext.lineWidth = theme.grid.width;
      gridContext.strokeStyle = theme.grid.color;
      gridContext.beginPath();
      gridContext.moveTo(0, y);
      gridContext.lineTo(gridContext.canvas.width / pixelRatio, y);
      gridContext.stroke();
    }
  }
}
