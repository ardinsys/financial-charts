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
});
