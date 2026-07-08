import { Indicator } from "../indicators/indicator";
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

export interface ChartEventMap {
  "indicator-visibility-changed": IndicatorVisibilityChangedEvent;
  "indicator-settings-open": IndicatorSettingsOpenEvent;
  "indicator-remove": IndicatorRemoveEvent;
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

  emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => {
        listener(data);
      });
    }
  }
}
