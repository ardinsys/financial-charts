import { describe, expect, it } from "vitest";
import { DataStore } from "../src/data/data-store";

describe("DataStore", () => {
  it("applies explicit floor and round bucketing policies", () => {
    expect(DataStore.bucketTime(89, 60, "floor")).toBe(60);
    expect(DataStore.bucketTime(89, 60, "round")).toBe(60);
    expect(DataStore.bucketTime(91, 60, "floor")).toBe(60);
    expect(DataStore.bucketTime(91, 60, "round")).toBe(120);
    expect(DataStore.bucketTime(-1, 60, "floor")).toBe(-60);
    expect(DataStore.bucketTime(-1, 60, "round")).toBe(-0);
  });

  it("handles empty stores", () => {
    const store = new DataStore();

    expect(store.length).toBe(0);
    expect(store.get(0)).toBeUndefined();
    expect(store.indexOfTime(100)).toBe(-1);
    expect(store.nearestIndex(100)).toBe(-1);
    expect(store.visibleSlice(0, 100)).toEqual([]);
  });

  it("handles single-point lookups and out-of-range nearest searches", () => {
    const store = new DataStore([{ time: 100, close: 12 }]);

    expect(store.length).toBe(1);
    expect(store.get(0)).toEqual({ time: 100, close: 12 });
    expect(store.indexOfTime(100)).toBe(0);
    expect(store.indexOfTime(99)).toBe(-1);
    expect(store.nearestIndex(0)).toBe(0);
    expect(store.nearestIndex(200)).toBe(0);
    expect(store.visibleSlice(0, 99)).toEqual([]);
    expect(store.visibleSlice(100, 100)).toEqual([{ time: 100, close: 12 }]);
  });

  it("returns the first duplicate-time index and slices duplicate bars", () => {
    const store = new DataStore([
      { time: 100, close: 10 },
      { time: 100, close: 11 },
      { time: 160, close: 12 }
    ]);

    expect(store.indexOfTime(100)).toBe(0);
    expect(store.nearestIndex(100)).toBe(0);
    expect(store.visibleSlice(100, 100)).toEqual([
      { time: 100, close: 10 },
      { time: 100, close: 11 }
    ]);
  });

  it("finds nearest indices with binary-search semantics", () => {
    const store = new DataStore(
      Array.from({ length: 4096 }, (_, index) => ({
        time: index * 60_000,
        close: index
      }))
    );

    expect(store.indexOfTime(2048 * 60_000)).toBe(2048);
    expect(store.indexOfTime(2048 * 60_000 + 1)).toBe(-1);
    expect(store.nearestIndex(2048 * 60_000 + 29_999)).toBe(2048);
    expect(store.nearestIndex(2048 * 60_000 + 30_001)).toBe(2049);
  });

  it("slices by fractional index windows", () => {
    const store = new DataStore([
      { time: 100, close: 10 },
      { time: 500, close: 11 },
      { time: 900, close: 12 },
      { time: 1_300, close: 13 }
    ]);

    expect(store.times()).toEqual([100, 500, 900, 1_300]);
    expect(store.times()).toBe(store.times());
    expect(store.indexRangeForTimeRange(500, 900)).toEqual({ from: 1, to: 3 });
    expect(store.visibleIndexSlice(0.5, 2.1)).toEqual([
      { time: 100, close: 10 },
      { time: 500, close: 11 },
      { time: 900, close: 12 }
    ]);
  });

  it("reuses stable snapshots until stored data changes", () => {
    const store = new DataStore([{ time: 60, close: 10 }]);
    const initial = store.snapshot();

    expect(store.snapshot()).toBe(initial);

    store.append({ time: 120, close: 11 });
    const afterAppend = store.snapshot();
    expect(afterAppend).not.toBe(initial);
    expect(store.snapshot()).toBe(afterAppend);

    store.merge({ time: 125, close: 12 }, 60);
    const afterReplacement = store.snapshot();
    expect(afterReplacement).not.toBe(afterAppend);
    expect(afterAppend).toEqual([
      { time: 60, close: 10 },
      { time: 120, close: 11 }
    ]);
    expect(afterReplacement).toEqual([
      { time: 60, close: 10 },
      { time: 120, close: 12 }
    ]);

    store.merge({ time: 180, close: 13 }, 60);
    const afterInsertion = store.snapshot();
    expect(afterInsertion).not.toBe(afterReplacement);
    expect(store.snapshot()).toBe(afterInsertion);
  });

  it("inserts appended points in chronological order", () => {
    const store = new DataStore([{ time: 120, close: 12 }]);
    const initialTimes = store.times();

    expect(store.append({ time: 60, close: 11 })).toBe(0);
    expect(store.append({ time: 180, close: 13 })).toBe(2);
    expect(store.snapshot().map((point) => point.time)).toEqual([60, 120, 180]);
    expect(store.times()).not.toBe(initialTimes);
    expect(store.times()).toEqual([60, 120, 180]);
  });

  it("collapses streaming points into step-size buckets", () => {
    const store = new DataStore();

    expect(
      store.merge(
        { time: 65, open: 10, high: 12, low: 9, close: 11, volume: 100 },
        60
      )
    ).toBe(true);
    expect(
      store.merge(
        { time: 119, open: 11, high: 14, low: 8, close: 13, volume: 50 },
        60
      )
    ).toBe(false);
    expect(
      store.merge(
        { time: 120, open: 13, high: 15, low: 12, close: 14, volume: 80 },
        60
      )
    ).toBe(true);

    expect(store.snapshot()).toEqual([
      { time: 60, open: 10, high: 14, low: 8, close: 13, volume: 150 },
      { time: 120, open: 13, high: 15, low: 12, close: 14, volume: 80 }
    ]);
  });

  it("merges arrays into bucketed bars", () => {
    expect(
      DataStore.merge(
        [
          { time: 65, open: 10, high: 12, low: 9, close: 11, volume: 100 },
          { time: 119, open: 11, high: 14, low: 8, close: 13, volume: 50 },
          { time: 120, open: 13, high: 15, low: 12, close: 14, volume: 80 }
        ],
        60
      )
    ).toEqual([
      { time: 60, open: 10, high: 14, low: 8, close: 13, volume: 150 },
      { time: 120, open: 13, high: 15, low: 12, close: 14, volume: 80 }
    ]);
  });

  it("reuses owned points when mapping does not change them", () => {
    const source = new DataStore([{ time: 60, close: 10 }]);
    const mapped = source.createMappedStore(60);

    expect(mapped.get(0)).toBe(source.get(0));

    const rebucketedSource = new DataStore([{ time: 65, close: 10 }]);
    const rebucketed = rebucketedSource.createMappedStore(60);

    expect(rebucketed.get(0)).not.toBe(rebucketedSource.get(0));
    expect(rebucketed.get(0)).toEqual({ time: 60, close: 10 });
  });

  it("sorts full datasets and merges partial or zero-valued buckets", () => {
    const input = [
      { time: 119, high: null, close: 0, volume: null },
      { time: 65, open: 0, high: 2, low: 0, close: 1, volume: 0 },
      { time: 90, open: null, high: 3, low: null, close: null }
    ];

    expect(DataStore.merge(input, 60)).toEqual([
      { time: 60, open: 0, high: 3, low: 0, close: 0, volume: 0 }
    ]);
    expect(input.map((point) => point.time)).toEqual([119, 65, 90]);
  });

  it("uses the first available open and last available close for duplicates", () => {
    expect(
      DataStore.merge(
        [
          { time: 60, close: 1 },
          { time: 60, open: 0, close: null },
          { time: 60, open: 2, close: 0 }
        ],
        60
      )
    ).toEqual([{ time: 60, open: 0, close: 0 }]);
  });

  it("owns stored points independently of caller input", () => {
    const point = { time: 65, close: 0 };
    const result = DataStore.merge([point], 60);

    point.close = 10;

    expect(result).toEqual([{ time: 60, close: 0 }]);
  });

  it("rejects non-finite values and invalid bucket sizes", () => {
    expect(() => DataStore.merge([{ time: Number.NaN }], 60)).toThrow(
      "ChartData.time must be a finite number."
    );
    expect(() =>
      DataStore.merge([{ time: 60, close: Number.POSITIVE_INFINITY }], 60)
    ).toThrow("ChartData.close must be a finite number when present.");
    expect(() => DataStore.merge([{ time: 60 }], 0)).toThrow(
      "stepSize must be a finite number greater than zero."
    );
  });
});
