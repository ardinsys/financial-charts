import { describe, expect, it } from "vitest";
import { ChartModel } from "../src/chart/chart-model";

describe("ChartModel data ownership", () => {
  it("owns stable mapped snapshots independently of caller input", () => {
    const model = new ChartModel();
    const point = { time: 65_000, close: 1 };
    const input = [point];

    model.replaceData(input, 60_000);
    const snapshot = model.getData();
    point.close = 2;
    input.push({ time: 120_000, close: 3 });

    expect(snapshot).toEqual([{ time: 60_000, close: 1 }]);
    expect(model.getData()).toBe(snapshot);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
  });

  it("remaps from retained source timestamps when the step size changes", () => {
    const model = new ChartModel();
    model.replaceData(
      [
        { time: 30_000, open: 1, close: 2 },
        { time: 90_000, open: 3, close: 4 }
      ],
      60_000
    );

    model.remapData(120_000);

    expect(model.getData()).toEqual([
      { time: 0, open: 1, close: 4 }
    ]);
  });

  it("merges streaming data and rejects backward source timestamps", () => {
    const model = new ChartModel();
    model.replaceData([{ time: 30_000, close: 1 }], 60_000);

    const mappedPoint = model.appendData(
      { time: 45_000, close: 2 },
      60_000
    );

    expect(mappedPoint).toEqual({ time: 0, close: 2 });
    expect(model.getData()).toEqual([{ time: 0, close: 2 }]);
    expect(() =>
      model.appendData({ time: 40_000, close: 3 }, 60_000)
    ).toThrow(
      "updateData() requires a timestamp at or after the latest point. Use setData() to apply older corrections."
    );
  });

  it("owns stable time and logical range snapshots", () => {
    const model = new ChartModel();
    const configuredRange = { start: 100, end: 400 };

    model.configureTimeRange(configuredRange, 60, 5);
    configuredRange.start = 0;
    const timeRange = model.getTimeRange();

    expect(timeRange).toEqual({ start: 100, end: 400 });
    expect(Object.isFrozen(timeRange)).toBe(true);
    expect(model.getTimeRange()).toBe(timeRange);

    model.replaceData(
      [
        { time: 100, close: 1 },
        { time: 160, close: 2 },
        { time: 220, close: 3 }
      ],
      60
    );
    model.refreshIndexBounds({ minimumVisibleSlots: 1, reset: true });
    model.setVisibleIndexRange({ from: 0.25, to: 2.25 });
    const logicalRange = model.getVisibleIndexRange();

    expect(Object.isFrozen(logicalRange)).toBe(true);
    expect(model.setVisibleIndexRange(logicalRange)).toBe(false);
    expect(model.getVisibleIndexRange()).toBe(logicalRange);
  });

  it("derives auto time and logical bounds from data and viewport capacity", () => {
    const model = new ChartModel();
    model.replaceData(
      [
        { time: 0, close: 1 },
        { time: 60, close: 2 }
      ],
      60
    );

    model.configureTimeRange("auto", 60, 4);
    model.refreshIndexBounds({ minimumVisibleSlots: 4, reset: true });

    expect(model.getTimeRange()).toEqual({ start: 0, end: 240 });
    expect(model.getVisibleIndexRange()).toEqual({
      from: 0,
      to: 4,
      rightOffset: 2
    });
    expect(model.isPinnedToRightEdge()).toBe(true);
  });

  it("converts precise time windows without losing fractional indexes", () => {
    const model = new ChartModel();
    model.replaceData(
      [
        { time: 0, close: 1 },
        { time: 60, close: 2 },
        { time: 120, close: 3 }
      ],
      60
    );
    model.configureTimeRange("auto", 60, 3);
    model.refreshIndexBounds({ minimumVisibleSlots: 3, reset: true });
    model.setVisibleIndexRange({ from: 0.5, to: 2.5 });

    const window = model.getVisibleTimeWindow(60, "center");

    expect(window).toEqual({ start: 0, end: 120 });
    expect(model.logicalRangeForTimeWindow(window, 60, "center")).toEqual({
      from: 0.5,
      to: 2.5
    });
    expect(model.getVisibleTimeRange(60)).toEqual({ start: 0, end: 180 });
  });

  it("clamps logical ranges and rejects non-finite boundaries", () => {
    const model = new ChartModel();
    model.replaceData(
      [
        { time: 0, close: 1 },
        { time: 60, close: 2 },
        { time: 120, close: 3 }
      ],
      60
    );
    model.configureTimeRange("auto", 60, 3);
    model.refreshIndexBounds({ minimumVisibleSlots: 3, reset: true });

    model.setVisibleIndexRange({ from: -10, to: 10 });
    expect(model.getVisibleIndexRange()).toEqual({
      from: 0,
      to: 3,
      rightOffset: 0
    });
    expect(() =>
      model.setVisibleIndexRange({ from: Number.NaN, to: 2 })
    ).toThrow("Visible index range values must be finite.");
    expect(() =>
      model.logicalRangeForTimeRange({
        start: 0,
        end: Number.POSITIVE_INFINITY
      })
    ).toThrow("Visible time range values must be finite.");
  });
});
