import type {
  PaneledIndicator,
  InitParams
} from "../indicators/paneled-indicator";
import type { TimeScale } from "../scales/time-scale";
import type {
  ChartDOMAdapter,
  PaneDividerHandle,
  PaneDividerModel
} from "../ui/chart-dom-adapter";
import { DefaultDOMAdapter } from "../ui/default-dom-adapter";
import { bindEvent, type Dispose } from "../utils/dom";
import { pixelRatio } from "../utils/screen";
import { Pane } from "./pane";

export type PaneHeightsInput =
  | Partial<Record<number, number>>
  | readonly number[];

export interface ChartPaneSnapshot {
  readonly id: number;
  readonly height: number;
  readonly kind: "main" | "indicator";
  readonly indicatorInstanceId?: string;
}

interface PaneLayoutGeometry {
  width: number;
  height: number;
  yAxisWidth: number;
  containerWidth: number;
  themeKey: string;
}

interface PaneLayoutOptions {
  mainPaneMinHeight: number;
  indicatorPaneMinHeight: number;
  dividerHeight: number;
  onInteractiveResize(): void;
}

type PaneResizeDrag = {
  dividerIndex: number;
  startClientY: number;
  beforeStartHeight: number;
  afterStartHeight: number;
  disposers: Dispose[];
};

export class PaneLayout {
  private readonly mainPane = new Pane(0);
  private panes: readonly Pane[] = Object.freeze([this.mainPane]);
  private paneSnapshot?: readonly ChartPaneSnapshot[];
  private nextPaneId = 1;
  private readonly paneByIndicator = new Map<
    PaneledIndicator<any, any>,
    Pane
  >();
  private readonly indicatorByPane = new Map<
    Pane,
    PaneledIndicator<any, any>
  >();
  private readonly paneHeights = new Map<Pane, number>();
  private paneHeightsCustomized = false;
  private readonly dividerHandles: PaneDividerHandle[] = [];
  private resizeDrag?: PaneResizeDrag;
  private restoredPaneIds?: ReadonlyMap<string, number>;

  constructor(
    private readonly container: HTMLElement,
    private readonly domAdapter: ChartDOMAdapter,
    private readonly options: PaneLayoutOptions
  ) {}

  getPanes(): readonly Pane[] {
    return this.panes;
  }

  getMainPane(): Pane {
    return this.mainPane;
  }

  getSnapshot(): readonly ChartPaneSnapshot[] {
    this.paneSnapshot ??= freezeSnapshot(
      this.panes.map((pane) => {
        const indicator = this.indicatorByPane.get(pane);
        return Object.freeze({
          id: pane.getId(),
          height: this.getPaneHeight(pane),
          kind: pane === this.mainPane ? "main" : "indicator",
          ...(indicator
            ? { indicatorInstanceId: indicator.getInstanceId() }
            : {})
        });
      })
    );
    return this.paneSnapshot;
  }

  getMainSnapshot(): ChartPaneSnapshot {
    return this.getSnapshot()[0];
  }

  getPaneForIndicator(indicator: PaneledIndicator<any, any>): Pane | undefined {
    return this.paneByIndicator.get(indicator);
  }

  getIndicatorForPane(pane: Pane): PaneledIndicator<any, any> | undefined {
    return this.indicatorByPane.get(pane);
  }

  getPaneAtY(y: number): Pane | undefined {
    return this.panes.find((pane) => pane.containsY(y));
  }

  getPaneById(id?: number): Pane {
    if (id === undefined) return this.mainPane;
    return this.panes.find((pane) => pane.getId() === id) ?? this.mainPane;
  }

  getPaneHeight(pane: Pane): number {
    return this.paneHeights.get(pane) ?? pane.getRegion().height;
  }

  getPaneHeights(): Record<number, number> {
    return Object.fromEntries(
      this.panes.map((pane) => [pane.getId(), this.getPaneHeight(pane)])
    );
  }

  setRestoredPaneIds(ids?: ReadonlyMap<string, number>): void {
    this.restoredPaneIds = ids;
  }

  addIndicatorPane(
    indicator: PaneledIndicator<any, any>,
    timeScale: TimeScale
  ): Pane {
    const restoredPaneId = this.restoredPaneIds?.get(indicator.getInstanceId());
    const paneId = restoredPaneId ?? this.nextPaneId;
    this.nextPaneId = Math.max(this.nextPaneId, paneId + 1);
    const pane = new Pane(paneId);
    pane.setTimeScale(timeScale);
    this.panes = freezeSnapshot([...this.panes, pane]);
    this.paneSnapshot = undefined;
    this.paneByIndicator.set(indicator, pane);
    this.indicatorByPane.set(pane, indicator);
    return pane;
  }

  removeIndicatorPane(indicator: PaneledIndicator<any, any>): Pane | undefined {
    const pane = this.paneByIndicator.get(indicator);
    if (!pane) return undefined;

    this.paneByIndicator.delete(indicator);
    this.indicatorByPane.delete(pane);
    this.paneHeights.delete(pane);
    this.panes = freezeSnapshot(this.panes.filter((item) => item !== pane));
    this.paneSnapshot = undefined;
    return pane;
  }

  setPaneHeights(heights: PaneHeightsInput, totalHeight: number): void {
    const desired = new Map(this.paneHeights);
    this.panes.forEach((pane, index) => {
      const value = Array.isArray(heights)
        ? heights[index]
        : heights[pane.getId()];
      if (value == undefined) return;
      desired.set(pane, value);
    });

    this.paneHeightsCustomized = true;
    this.normalizePaneHeights(desired, totalHeight);
  }

  applyGeometry(geometry: PaneLayoutGeometry): void {
    if (!this.paneHeightsCustomized) {
      this.resetDefaultPaneHeights(geometry.height);
    } else {
      this.normalizePaneHeights(this.paneHeights, geometry.height);
    }

    let y = 0;
    for (const pane of this.panes) {
      const height = this.paneHeights.get(pane) ?? 0;
      pane.setRegion({ x: 0, y, width: geometry.width, height });
      pane.setYAxisRegion({
        x: geometry.width,
        y,
        width: geometry.yAxisWidth,
        height
      });
      y += height;
    }

    this.renderPaneDividers(geometry.themeKey, geometry.containerWidth);
  }

  updatePaneDividers(themeKey: string): void {
    this.renderPaneDividers(themeKey, this.container.offsetWidth);
  }

  resizeIndicators(): void {
    for (const [indicator, pane] of this.paneByIndicator) {
      indicator.resize(this.getPaneInitParams(pane));
    }
  }

  getPaneInitParams(pane: Pane): InitParams {
    const region = pane.getRegion();
    const yAxisRegion = pane.getYAxisRegion();
    return {
      width: region.width + yAxisRegion.width,
      height: region.height,
      y: region.y,
      x: region.x,
      devicePixelRatio: pixelRatio(),
      pane
    };
  }

  dispose(): void {
    this.stopResize();
    for (const divider of this.dividerHandles.splice(0)) divider.destroy();
    this.paneByIndicator.clear();
    this.indicatorByPane.clear();
    this.paneHeights.clear();
    this.panes = Object.freeze([this.mainPane]);
    this.paneSnapshot = undefined;
    this.restoredPaneIds = undefined;
  }

  private getPaneMinHeight(pane: Pane): number {
    return pane === this.mainPane
      ? this.options.mainPaneMinHeight
      : this.options.indicatorPaneMinHeight;
  }

  private getDefaultIndicatorPaneHeight(totalHeight: number): number {
    const indicatorCount = this.paneByIndicator.size;
    if (indicatorCount === 0) return 0;

    const canUseQuarter =
      totalHeight / (indicatorCount + 1) > totalHeight * 0.25;
    return canUseQuarter
      ? totalHeight * 0.25
      : (totalHeight * 0.75) / indicatorCount;
  }

  private resetDefaultPaneHeights(totalHeight: number): void {
    const indicatorHeight = this.getDefaultIndicatorPaneHeight(totalHeight);
    const desired = new Map<Pane, number>();
    desired.set(
      this.mainPane,
      totalHeight - indicatorHeight * this.paneByIndicator.size
    );
    for (const pane of this.paneByIndicator.values()) {
      desired.set(pane, indicatorHeight);
    }
    this.normalizePaneHeights(desired, totalHeight);
  }

  private normalizePaneHeights(
    desired: ReadonlyMap<Pane, number>,
    totalHeight: number
  ): void {
    const next = new Map<Pane, number>();
    const minHeightSum = this.panes.reduce(
      (sum, pane) => sum + this.getPaneMinHeight(pane),
      0
    );
    const minScale =
      minHeightSum > 0 && minHeightSum > totalHeight
        ? totalHeight / minHeightSum
        : 1;
    const getEffectiveMinHeight = (pane: Pane) =>
      this.getPaneMinHeight(pane) * minScale;

    for (const pane of this.panes) {
      const fallback =
        pane === this.mainPane
          ? totalHeight
          : this.getDefaultIndicatorPaneHeight(totalHeight);
      const height =
        desired.get(pane) ?? this.paneHeights.get(pane) ?? fallback;
      next.set(
        pane,
        Math.max(
          getEffectiveMinHeight(pane),
          Number.isFinite(height) ? height : 0
        )
      );
    }

    let delta =
      totalHeight - [...next.values()].reduce((sum, height) => sum + height, 0);
    if (delta > 0) {
      next.set(this.mainPane, (next.get(this.mainPane) ?? 0) + delta);
    } else if (delta < 0) {
      let remaining = -delta;
      const shrinkOrder = [
        this.mainPane,
        ...this.panes.filter((pane) => pane !== this.mainPane).reverse()
      ];
      for (const pane of shrinkOrder) {
        if (remaining <= 0) break;
        const minHeight = getEffectiveMinHeight(pane);
        const height = next.get(pane) ?? minHeight;
        const shrink = Math.min(height - minHeight, remaining);
        if (shrink <= 0) continue;
        next.set(pane, height - shrink);
        remaining -= shrink;
      }

      if (remaining > 0 && totalHeight > 0) {
        const currentTotal = [...next.values()].reduce(
          (sum, height) => sum + height,
          0
        );
        const scale = totalHeight / currentTotal;
        for (const pane of this.panes) {
          next.set(pane, (next.get(pane) ?? 0) * scale);
        }
      }
    }

    const heightsChanged = this.panes.some(
      (pane) => this.paneHeights.get(pane) !== next.get(pane)
    );
    this.paneHeights.clear();
    for (const pane of this.panes) {
      this.paneHeights.set(pane, next.get(pane) ?? 0);
    }
    if (heightsChanged) this.paneSnapshot = undefined;
  }

  private renderPaneDividers(themeKey: string, containerWidth: number): void {
    const dividerCount = Math.max(0, this.panes.length - 1);
    while (this.dividerHandles.length > dividerCount) {
      this.dividerHandles.pop()?.destroy();
    }

    for (let index = 0; index < dividerCount; index++) {
      const beforePane = this.panes[index];
      const afterPane = this.panes[index + 1];
      const beforeRegion = beforePane.getRegion();
      const model: PaneDividerModel = {
        key: `pane-divider-${beforePane.getId()}-${afterPane.getId()}`,
        themeKey,
        beforePaneId: beforePane.getId(),
        afterPaneId: afterPane.getId(),
        x: 0,
        y:
          beforeRegion.y + beforeRegion.height - this.options.dividerHeight / 2,
        width: containerWidth,
        height: this.options.dividerHeight
      };

      let handle = this.dividerHandles[index];
      if (!handle) {
        handle = this.createPaneDividerHandle(model, index);
        this.dividerHandles[index] = handle;
        this.container.appendChild(handle.root);
      } else {
        handle.update(model);
      }
    }
  }

  private createPaneDividerHandle(
    model: PaneDividerModel,
    dividerIndex: number
  ): PaneDividerHandle {
    const fallbackAdapter = new DefaultDOMAdapter();
    const createPaneDivider =
      this.domAdapter.createPaneDivider?.bind(this.domAdapter) ??
      fallbackAdapter.createPaneDivider.bind(fallbackAdapter);
    return createPaneDivider(model, {
      onPointerDown: (event) => this.startResize(dividerIndex, event)
    });
  }

  private startResize(dividerIndex: number, event: PointerEvent): void {
    const beforePane = this.panes[dividerIndex];
    const afterPane = this.panes[dividerIndex + 1];
    if (!beforePane || !afterPane) return;

    this.stopResize();
    this.paneHeightsCustomized = true;
    this.resizeDrag = {
      dividerIndex,
      startClientY: event.clientY,
      beforeStartHeight: this.getPaneHeight(beforePane),
      afterStartHeight: this.getPaneHeight(afterPane),
      disposers: [
        bindEvent(window, "pointermove", this.onResizeMove),
        bindEvent(window, "pointerup", this.onResizeEnd),
        bindEvent(window, "pointercancel", this.onResizeEnd)
      ]
    };
  }

  private onResizeMove = (event: PointerEvent) => {
    if (!this.resizeDrag) return;
    event.preventDefault();

    const drag = this.resizeDrag;
    const beforePane = this.panes[drag.dividerIndex];
    const afterPane = this.panes[drag.dividerIndex + 1];
    if (!beforePane || !afterPane) return;

    const dy = event.clientY - drag.startClientY;
    const clampedDy = Math.max(
      this.getPaneMinHeight(beforePane) - drag.beforeStartHeight,
      Math.min(dy, drag.afterStartHeight - this.getPaneMinHeight(afterPane))
    );
    const desired = new Map(this.paneHeights);
    desired.set(beforePane, drag.beforeStartHeight + clampedDy);
    desired.set(afterPane, drag.afterStartHeight - clampedDy);
    this.normalizePaneHeights(
      desired,
      this.panes.reduce((sum, pane) => sum + this.getPaneHeight(pane), 0)
    );
    this.options.onInteractiveResize();
  };

  private onResizeEnd = (event: PointerEvent) => {
    event.preventDefault();
    this.stopResize();
  };

  private stopResize(): void {
    if (!this.resizeDrag) return;
    for (const dispose of this.resizeDrag.disposers.splice(0)) dispose();
    this.resizeDrag = undefined;
  }
}

function freezeSnapshot<T>(values: T[]): readonly T[] {
  return Object.freeze(values);
}
