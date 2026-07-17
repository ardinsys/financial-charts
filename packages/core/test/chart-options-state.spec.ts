import { describe, expect, it, vi } from "vitest";
import type { ControllerConstructor } from "../src/chart/chart-options";
import { ChartOptionsState } from "../src/chart/chart-options-state";
import { CandlestickController } from "../src/controllers/candle-controller";
import { LineController } from "../src/controllers/line-controller";

describe("ChartOptionsState", () => {
  it("owns retained inputs and reuses one public snapshot", () => {
    const timeRange = { start: 100, end: 400 };
    const themes = {
      owned: { randomColors: ["#123456"] },
    };
    const state = new ChartOptionsState(
      {
        type: "line",
        timeRange,
        stepSize: 60,
        theme: "owned",
        themes,
      },
      [LineController],
      false
    );
    const snapshot = state.getSnapshot();

    timeRange.start = 0;
    themes.owned.randomColors[0] = "#000000";

    expect(snapshot.timeRange).toEqual({ start: 100, end: 400 });
    expect(snapshot.theme.randomColors).toEqual(["#123456"]);
    expect(state.getSnapshot()).toBe(snapshot);
    expect(state.getResolved().theme).toBe(snapshot.theme);
  });

  it("creates one previous/current event only for effective updates", () => {
    const state = new ChartOptionsState(
      {
        type: "line",
        timeRange: "auto",
        stepSize: 60,
        volume: true,
        locale: "en-US",
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
    expect(state.getResolved()).toMatchObject({
      type: "candle",
      volume: false,
      locale: "hu-HU",
    });
  });

  it("replaces the controller snapshot when registration changes", () => {
    const controllers: ControllerConstructor[] = [LineController];
    const state = new ChartOptionsState(
      { type: "line", stepSize: 60 },
      controllers,
      false
    );
    const previous = state.getSnapshot();
    controllers.push(CandlestickController);

    expect(previous.controllers).toEqual([LineController]);

    const replacements: ControllerConstructor[] = [
      LineController,
      CandlestickController,
    ];
    state.setControllers(replacements);
    replacements.pop();

    expect(state.getSnapshot()).not.toBe(previous);
    expect(state.getSnapshot().controllers).toEqual([
      LineController,
      CandlestickController,
    ]);
  });
});
