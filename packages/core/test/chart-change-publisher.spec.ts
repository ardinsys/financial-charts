import { describe, expect, it, vi } from "vitest";
import { ChartChangePublisher } from "../src/chart/chart-change-publisher";
import type { ChartOptionsChangeEvent } from "../src/chart/chart-options";
import { EventEmitter } from "../src/chart/event-emitter";
import type { ExtensionHost } from "../src/plugin/extension-host";

describe("ChartChangePublisher", () => {
  it("publishes extensions, public events, and redraw in order", () => {
    const order: string[] = [];
    const extensions = {
      notifyOptionsChanged: vi.fn(() => order.push("extension-options")),
      notifyData: vi.fn(() => order.push("data")),
      notifyVisibleRangeChanged: vi.fn(() => order.push("range")),
    } as unknown as ExtensionHost;
    const events = new EventEmitter();
    events.on("options-change", () => order.push("public-options"));
    events.on("crosshair-change", () => order.push("crosshair-change"));
    events.on("crosshair-clear", () => order.push("crosshair-clear"));
    const redraw = vi.fn(() => order.push("redraw"));
    const publisher = new ChartChangePublisher(extensions, events, redraw);
    const options = {} as ChartOptionsChangeEvent;
    const data = [{ time: 0, close: 1 }];

    publisher.commit({
      options,
      data,
      visibleRange: { start: 0, end: 1 },
      crosshairChanged: {
        time: 0,
        y: 10,
        paneId: 0,
        price: 1,
        dataPoint: data[0],
      },
      crosshairCleared: true,
      redraw: ["series", "crosshair"],
    });

    expect(order).toEqual([
      "extension-options",
      "data",
      "range",
      "public-options",
      "crosshair-change",
      "crosshair-clear",
      "redraw",
    ]);
    expect(redraw).toHaveBeenCalledWith(["series", "crosshair"]);
  });

  it("preserves immediate redraws and ignores empty invalidations", () => {
    const extensions = {
      notifyOptionsChanged: vi.fn(),
      notifyData: vi.fn(),
      notifyVisibleRangeChanged: vi.fn(),
    } as unknown as ExtensionHost;
    const redraw = vi.fn();
    const publisher = new ChartChangePublisher(
      extensions,
      new EventEmitter(),
      redraw
    );

    publisher.commit({ redraw: [] });
    publisher.commit({ redraw: "series", immediate: true });

    expect(redraw).toHaveBeenCalledOnce();
    expect(redraw).toHaveBeenCalledWith("series", true);
  });
});
