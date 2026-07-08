import { Indicator } from "../indicators/indicator";
import type { Drawing } from "../drawings/drawing";
import { ChartData } from "./types";

interface IndicatorVisibilityChangedEvent {
  indicator: Indicator<any, any>;
  visible: boolean;
}

interface IndicatorSettingsOpenEvent {
  indicator: Indicator<any, any>;
}

interface IndicatorRemoveEvent {
  indicator: Indicator<any, any>;
}

interface DrawingEvent {
  drawing: Drawing;
}

export interface ChartEventMap {
  "indicator-visibility-changed": IndicatorVisibilityChangedEvent;
  "indicator-settings-open": IndicatorSettingsOpenEvent;
  "indicator-remove": IndicatorRemoveEvent;
  "drawing-create": DrawingEvent;
  "drawing-change": DrawingEvent;
  "drawing-delete": DrawingEvent;
  "drawing-select": DrawingEvent;
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
