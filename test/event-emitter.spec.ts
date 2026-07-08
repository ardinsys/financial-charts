import { describe, expect, it, vi } from "vitest";
import { ChartEventMap, EventEmitter } from "../src/chart/event-emitter";
import type { ChartData } from "../src/chart/types";

interface CustomEventMap extends ChartEventMap {
  "custom-ready": {
    id: string;
    count: number;
  };
}

describe("EventEmitter", () => {
  it("dispatches built-in chart events with the default event map", () => {
    const emitter = new EventEmitter();
    const listener = vi.fn((data: ChartEventMap["click"]) => data.point.time);
    const point: ChartData = { time: 123 };

    const unsubscribe = emitter.on("click", listener);
    emitter.emit("click", { event: new PointerEvent("click"), point });
    unsubscribe();
    emitter.emit("click", { event: new PointerEvent("click"), point });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveReturnedWith(point.time);
  });

  it("dispatches consumer-defined typed events", () => {
    const emitter = new EventEmitter<CustomEventMap>();
    const listener = vi.fn((data: CustomEventMap["custom-ready"]) => {
      const id: string = data.id;
      const count: number = data.count;
      return `${id}:${count}`;
    });

    emitter.on("custom-ready", listener);
    emitter.emit("custom-ready", { id: "feed", count: 2 });

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveReturnedWith("feed:2");
  });

  it("counts and clears listeners", () => {
    const emitter = new EventEmitter();
    const first = vi.fn();
    const second = vi.fn();

    emitter.on("click", first);
    emitter.on("touch-click", second);

    expect(emitter.listenerCount("click")).toBe(1);
    expect(emitter.listenerCount()).toBe(2);

    emitter.removeAllListeners("click");

    expect(emitter.listenerCount("click")).toBe(0);
    expect(emitter.listenerCount()).toBe(1);

    emitter.removeAllListeners();

    expect(emitter.listenerCount()).toBe(0);
  });
});
