import { Indicator } from "../indicators/indicator";
import type { Drawing, DrawingAnchor, DrawingJSON } from "../drawings/drawing";
import type { Pane } from "../panes/pane";
import { ChartData } from "./types";
import type { ChartOptionsChangeEvent } from "./chart-options";
import type { ChartStateRestoredEvent } from "./chart-state";

interface IndicatorEvent {
  indicator: Indicator<any, any>;
}

interface IndicatorVisibilityChangedEvent extends IndicatorEvent {
  visible: boolean;
}

interface DrawingEvent {
  drawing: Drawing;
}

export interface ChartCrosshairChangeEvent {
  dataPoint: ChartData;
  pane: Pane;
  time: number;
  y: number;
}

export interface DrawingSelectionEvent {
  drawing?: Drawing;
  id?: string;
  type?: string;
  paneId?: number;
  anchors?: DrawingAnchor[];
  json?: DrawingJSON;
}

export type DrawingFinishedOperation = "create" | "move";

export interface DrawingFinishedEvent extends DrawingEvent {
  operation: DrawingFinishedOperation;
  id: string;
  type: string;
  paneId: number;
  anchors: DrawingAnchor[];
  json: DrawingJSON;
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
  "state-restored": ChartStateRestoredEvent;
  "drawing-create": DrawingEvent;
  "drawing-change": DrawingEvent;
  "drawing-delete": DrawingEvent;
  "drawing-finished": DrawingFinishedEvent;
  "drawing-select": DrawingSelectionEvent;
  click: { event: PointerEvent; point: ChartData };
  "touch-click": { event: TouchEvent; point: ChartData };
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
    if (this.events[event]) {
      this.events[event].forEach((listener) => {
        listener(data);
      });
    }
  }
}
