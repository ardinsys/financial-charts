import { describe, expect, it, vi } from "vitest";
import { ChartOptionsState } from "../src/chart/chart-options-state";
import { CandlestickController } from "../src/controllers/candle-controller";
import { LineController } from "../src/controllers/line-controller";

describe("ChartOptionsState", () => {
  it("owns retained inputs and reuses one public snapshot", () => {
    const timeRange = { start: 100, end: 400 };
    const theme = {
      key: "owned",
      randomColors: ["#123456"]
    };
    const state = new ChartOptionsState(
      {
        type: "line",
        timeRange,
        stepSize: 60,
        theme
      },
      [LineController],
      false
    );
    const snapshot = state.getSnapshot();

    timeRange.start = 0;
    theme.randomColors[0] = "#000000";

    expect(snapshot.timeRange).toEqual({ start: 100, end: 400 });
    expect(snapshot.theme.randomColors).toEqual(["#123456"]);
    expect(state.getSnapshot()).toBe(snapshot);
    expect(state.getResolved().theme).toBe(snapshot.theme);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.theme.randomColors)).toBe(true);
  });

  it("creates one previous/current event only for effective updates", () => {
    const state = new ChartOptionsState(
      {
        type: "line",
        timeRange: "auto",
        stepSize: 60,
        volume: true,
        locale: "en-US"
      },
      [LineController, CandlestickController],
      false
    );
    const assertControllerType = vi.fn();
    const previous = state.getSnapshot();

    expect(
      state.applyUpdate(
        { type: "line", stepSize: 60, locale: "en-US" },
        assertControllerType
      )
    ).toBeUndefined();
    expect(state.getSnapshot()).toBe(previous);

    const event = state.applyUpdate(
      { type: "candle", volume: false, locale: "hu-HU" },
      assertControllerType
    )!;

    expect(assertControllerType).toHaveBeenCalledWith("candle");
    expect(event.previous).toBe(previous);
    expect(event.current).toBe(state.getSnapshot());
    expect(event.changedKeys).toEqual(["type", "volume", "locale"]);
    expect(Object.isFrozen(event.changedKeys)).toBe(true);
    expect(state.getResolved()).toMatchObject({
      type: "candle",
      volume: false,
      locale: "hu-HU"
    });
  });

  it("replaces the controller snapshot when registration changes", () => {
    const state = new ChartOptionsState(
      { type: "line", stepSize: 60 },
      [LineController],
      false
    );
    const previous = state.getSnapshot();

    state.setControllers([LineController, CandlestickController]);

    expect(state.getSnapshot()).not.toBe(previous);
    expect(state.getSnapshot().controllers).toEqual([
      LineController,
      CandlestickController
    ]);
    expect(Object.isFrozen(state.getSnapshot().controllers)).toBe(true);
  });
});
