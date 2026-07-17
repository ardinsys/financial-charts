import type { ChartCrosshairState } from "../interaction/crosshair";
import type { ExtensionHost } from "../plugin/extension-host";
import type { ChartRedrawPart } from "../render/chart-render-types";
import type { ChartOptionsChangeEvent } from "./chart-options";
import type { ChartEventMap, EventEmitter } from "./event-emitter";
import type { ChartData, TimeRange } from "./types";
import type { ChartPaneState } from "./chart-state";

export interface ChartChange {
  readonly data?: readonly ChartData[];
  readonly visibleRange?: TimeRange;
  readonly paneHeights?: readonly ChartPaneState[];
  readonly options?: ChartOptionsChangeEvent;
  readonly crosshairChanged?: ChartCrosshairState;
  readonly crosshairCleared?: boolean;
  readonly redraw?: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>;
  readonly immediate?: boolean;
}

/** Publishes completed chart mutations in lifecycle, public, render order. */
export class ChartChangePublisher {
  constructor(
    private readonly extensions: ExtensionHost,
    private readonly events: EventEmitter<ChartEventMap>,
    private readonly requestRedraw: (
      part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>,
      immediate?: boolean
    ) => void
  ) {}

  commit(change: ChartChange): void {
    if (change.options) {
      this.extensions.notifyOptionsChanged(change.options);
    }
    if (change.data) {
      this.extensions.notifyData(change.data);
    }
    if (change.visibleRange) {
      this.extensions.notifyVisibleRangeChanged(change.visibleRange);
    }
    if (change.paneHeights) {
      this.extensions.notifyPaneHeightsChanged(change.paneHeights);
    }

    if (change.options) {
      this.events.emit("options-change", change.options);
    }
    if (change.visibleRange) {
      this.events.emit("visible-range-change", change.visibleRange);
    }
    if (change.paneHeights) {
      this.events.emit("pane-heights-change", change.paneHeights);
    }
    if (change.crosshairChanged) {
      this.events.emit("crosshair-change", change.crosshairChanged);
    }
    if (change.crosshairCleared) {
      this.events.emit("crosshair-clear", {});
    }

    const shouldRedraw = Array.isArray(change.redraw)
      ? change.redraw.length > 0
      : change.redraw !== undefined;
    if (change.redraw && shouldRedraw) {
      if (change.immediate) {
        this.requestRedraw(change.redraw, true);
      } else {
        this.requestRedraw(change.redraw);
      }
    }
  }
}
