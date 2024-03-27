import { Indicator } from "../indicators/indicator";

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

interface EventMap {
  "indicator-visibility-changed": IndicatorVisibilityChangedEvent;
  "indicator-settings-open": IndicatorSettingsOpenEvent;
  "indicator-remove": IndicatorRemoveEvent;
}

export class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on<K extends keyof EventMap>(event: K, listener: (data: EventMap[K]) => any) {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(listener);

    return () => {
      this.events[event] = this.events[event].filter((l) => l !== listener);
    };
  }

  off<K extends keyof EventMap>(
    event: K,
    listener: (data: EventMap[K]) => any
  ) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter((l) => l !== listener);
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]) {
    if (this.events[event]) {
      this.events[event].forEach((listener) => {
        listener(data);
      });
    }
  }
}
