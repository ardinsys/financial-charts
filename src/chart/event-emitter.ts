import type {
  DefaultIndicatorOptions,
  Indicator
} from "../indicators/indicator";
import type { Drawing, DrawingAnchor, DrawingJSON } from "../drawings/drawing";
import type { ChartData, TimeRange } from "./types";
import type { ChartOptionsChangeEvent } from "./chart-options";
import type { ChartPaneState, ChartStateRestoredEvent } from "./chart-state";
import type { ChartCrosshairState } from "../interaction/crosshair";

interface IndicatorEvent {
  readonly indicator: Indicator<object, DefaultIndicatorOptions>;
}

interface IndicatorVisibilityChangedEvent extends IndicatorEvent {
  readonly visible: boolean;
}

interface DrawingEvent {
  readonly drawing: Drawing;
}

export type ChartCrosshairChangeEvent = ChartCrosshairState;

export interface DrawingSelectionEvent {
  readonly drawing?: Drawing;
  readonly id?: string;
  readonly type?: string;
  readonly paneId?: number;
  readonly anchors?: readonly DrawingAnchor[];
  readonly json?: DrawingJSON;
}

export type DrawingFinishedOperation = "create" | "move";

export interface DrawingFinishedEvent extends DrawingEvent {
  readonly operation: DrawingFinishedOperation;
  readonly id: string;
  readonly type: string;
  readonly paneId: number;
  readonly anchors: readonly DrawingAnchor[];
  readonly json: DrawingJSON;
}

export interface ChartEventMap {
  "indicator-add": IndicatorEvent;
  "indicator-change": IndicatorEvent;
  "indicator-visibility-changed": IndicatorVisibilityChangedEvent;
  "indicator-settings-open": IndicatorEvent;
  "indicator-remove": IndicatorEvent;
  "crosshair-change": ChartCrosshairChangeEvent;
  "crosshair-clear": {};
  "options-change": ChartOptionsChangeEvent;
  "visible-range-change": TimeRange;
  "pane-heights-change": readonly ChartPaneState[];
  "state-restored": ChartStateRestoredEvent;
  "drawing-create": DrawingEvent;
  "drawing-change": DrawingEvent;
  "drawing-delete": DrawingEvent;
  "drawing-finished": DrawingFinishedEvent;
  "drawing-select": DrawingSelectionEvent;
  click: { readonly event: PointerEvent; readonly point: ChartData };
  "touch-click": { readonly event: TouchEvent; readonly point: ChartData };
}

type EventListener<TEventMap, K extends keyof TEventMap> = (
  data: TEventMap[K]
) => void;

export class EventEmitter<TEventMap extends object = ChartEventMap> {
  private events: {
    [K in keyof TEventMap]?: Array<EventListener<TEventMap, K>>;
  } = {};

  on<K extends keyof TEventMap>(
    event: K,
    listener: EventListener<TEventMap, K>
  ) {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(listener);

    return () => {
      this.off(event, listener);
    };
  }

  off<K extends keyof TEventMap>(
    event: K,
    listener: EventListener<TEventMap, K>
  ) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((l) => l !== listener);
    }
  }

  listenerCount<K extends keyof TEventMap>(event?: K) {
    if (event !== undefined) {
      return this.events[event]?.length ?? 0;
    }

    let count = 0;
    for (const listeners of Object.values(this.events) as Array<
      unknown[] | undefined
    >) {
      count += listeners?.length ?? 0;
    }
    return count;
  }

  removeAllListeners<K extends keyof TEventMap>(event?: K) {
    if (event !== undefined) {
      delete this.events[event];
      return;
    }

    this.events = {};
  }

  emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]) {
    const listeners = this.events[event];
    if (!listeners) return;

    let firstError: unknown;
    listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (error) {
        firstError ??= error;
      }
    });
    if (firstError !== undefined) throw firstError;
  }
}
