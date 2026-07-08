import { PriceScale } from "../scales/price-scale";
import type { TimeScale } from "../scales/time-scale";

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

export class Pane {
  private region: PaneRegion = { x: 0, y: 0, width: 0, height: 0 };
  private yAxisRegion: PaneRegion = { x: 0, y: 0, width: 0, height: 0 };
  private readonly priceScale = new PriceScale({ min: 0, max: 1 });
  private timeScale?: TimeScale;
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

  setTimeScale(timeScale: TimeScale) {
    this.timeScale = timeScale;
  }

  getTimeScale() {
    return this.timeScale;
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
}
