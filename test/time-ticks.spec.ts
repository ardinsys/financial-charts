import { describe, expect, it, vi } from "vitest";
import { DefaultFormatter } from "../src/chart/formatter";
import { TimeTickGenerator } from "../src/scales/ticks/time-ticks";

const hour = 60 * 60_000;
const day = 24 * hour;

function createFormatter() {
  return new DefaultFormatter({ locale: "en-US", timeZone: "UTC" });
}

function generateTicks(times: number[], targetTickCount = 8) {
  return new TimeTickGenerator().generate({
    times,
    visibleRange: { from: 0, to: times.length },
    formatter: createFormatter(),
    targetTickCount,
  });
}

describe("TimeTickGenerator", () => {
  it("uses sub-minute labels for millisecond ranges", () => {
    const start = Date.UTC(2024, 0, 2, 3, 4, 5);
    const times = Array.from({ length: 5 }, (_, index) => {
      return start + index * 100;
    });

    const ticks = generateTicks(times, 10);

    expect(ticks.map((tick) => tick.kind)).toEqual([
      "subMinute",
      "subMinute",
      "subMinute",
      "subMinute",
      "subMinute",
    ]);
    expect(ticks.map((tick) => tick.label)).toEqual([
      "04:05.000",
      "04:05.100",
      "04:05.200",
      "04:05.300",
      "04:05.400",
    ]);
  });

  it("uses second labels for short intraminute ranges", () => {
    const start = Date.UTC(2024, 0, 2, 3, 4, 5);
    const times = Array.from({ length: 5 }, (_, index) => {
      return start + index * 1_000;
    });

    const ticks = generateTicks(times, 10);

    expect(ticks.map((tick) => tick.kind)).toEqual([
      "second",
      "second",
      "second",
      "second",
      "second",
    ]);
    expect(ticks.map((tick) => tick.label)).toEqual([
      "3:04:05 AM",
      "3:04:06 AM",
      "3:04:07 AM",
      "3:04:08 AM",
      "3:04:09 AM",
    ]);
  });

  it.each([10, 30, 90])(
    "generates useful minute labels for a %i-minute window",
    (durationMinutes) => {
      const start = Date.UTC(2024, 0, 2, 9, 7);
      const times = Array.from(
        { length: durationMinutes + 1 },
        (_, index) => start + index * 60_000
      );

      const ticks = generateTicks(times, 8);

      expect(ticks.length).toBeGreaterThanOrEqual(3);
      expect(ticks.length).toBeLessThanOrEqual(9);
      expect(
        ticks.every((tick) =>
          ["minute", "hour", "day"].includes(tick.kind)
        )
      ).toBe(true);
    }
  );

  it("uses the first bar in second and sub-minute boundaries", () => {
    const secondStart = Date.UTC(2024, 0, 2, 3, 4, 5, 250);
    const secondTicks = generateTicks(
      Array.from({ length: 5 }, (_, index) => secondStart + index * 1_000),
      10
    );
    const subMinuteStart = Date.UTC(2024, 0, 2, 3, 4, 5, 50);
    const subMinuteTicks = generateTicks(
      Array.from({ length: 5 }, (_, index) => subMinuteStart + index * 100),
      10
    );

    expect(secondTicks).toHaveLength(5);
    expect(secondTicks.every((tick) => tick.kind === "second")).toBe(true);
    expect(subMinuteTicks).toHaveLength(5);
    expect(subMinuteTicks.every((tick) => tick.kind === "subMinute")).toBe(
      true
    );
  });

  it("reuses timezone calendar parts without changing generated labels", () => {
    const formatter = createFormatter();
    const generator = new TimeTickGenerator();
    const start = Date.UTC(2024, 0, 2, 9, 7);
    const times = Array.from(
      { length: 31 },
      (_, index) => start + index * 60_000
    );
    const formatToParts = vi.spyOn(
      Intl.DateTimeFormat.prototype,
      "formatToParts"
    );

    const first = generator.generate({
      times,
      visibleRange: { from: 0, to: times.length },
      formatter,
      targetTickCount: 8
    });
    const callsAfterFirstGeneration = formatToParts.mock.calls.length;
    const cached = generator.generate({
      times,
      visibleRange: { from: 0, to: times.length },
      formatter,
      targetTickCount: 8
    });

    expect(cached).toEqual(first);
    expect(formatToParts).toHaveBeenCalledTimes(callsAfterFirstGeneration);
    expect(cached).toEqual(
      new TimeTickGenerator().generate({
        times,
        visibleRange: { from: 0, to: times.length },
        formatter,
        targetTickCount: 8
      })
    );
  });

  it("chooses stable intraday hour ticks", () => {
    const start = Date.UTC(2024, 0, 2, 9);
    const times = Array.from({ length: 15 }, (_, index) => {
      return start + index * 30 * 60_000;
    });

    const ticks = generateTicks(times, 5);

    expect(ticks.map((tick) => tick.index)).toEqual([2, 6, 10, 14]);
    expect(ticks.map((tick) => tick.label)).toEqual([
      "10:00 AM",
      "12:00 PM",
      "2:00 PM",
      "4:00 PM",
    ]);
    expect(ticks.every((tick) => tick.kind === "hour")).toBe(true);
  });

  it("anchors day and week ticks to real bars across market gaps", () => {
    const friday = Date.UTC(2024, 0, 5);
    const monday = Date.UTC(2024, 0, 8);
    const tuesday = Date.UTC(2024, 0, 9);
    const nextMonday = Date.UTC(2024, 0, 15);

    const ticks = generateTicks([friday, monday, tuesday, nextMonday], 10);

    expect(
      ticks.map((tick) => ({
        index: tick.index,
        time: tick.time,
        kind: tick.kind,
        label: tick.label,
      }))
    ).toEqual([
      { index: 0, time: friday, kind: "day", label: "5" },
      { index: 1, time: monday, kind: "week", label: "8" },
      { index: 2, time: tuesday, kind: "day", label: "9" },
      { index: 3, time: nextMonday, kind: "week", label: "15" },
    ]);
  });

  it("selects month and year ticks for multi-year ranges", () => {
    const times = Array.from({ length: 36 }, (_, index) => {
      return Date.UTC(2022 + Math.floor(index / 12), index % 12, 1);
    });

    const ticks = generateTicks(times, 8);

    expect(ticks.map((tick) => tick.index)).toEqual([0, 6, 12, 18, 24, 30]);
    expect(ticks.map((tick) => tick.kind)).toEqual([
      "year",
      "month",
      "year",
      "month",
      "year",
      "month",
    ]);
    expect(ticks.map((tick) => tick.label)).toEqual([
      "2022",
      "Jul",
      "2023",
      "Jul",
      "2024",
      "Jul",
    ]);
  });

  it("keeps indices unique and increasing when one bar crosses many boundaries", () => {
    const ticks = generateTicks(
      [
        Date.UTC(2024, 0, 31),
        Date.UTC(2024, 2, 1),
        Date.UTC(2024, 2, 4),
      ],
      10
    );

    expect(ticks.map((tick) => tick.index)).toEqual([0, 1, 2]);
    expect(new Set(ticks.map((tick) => tick.index)).size).toBe(ticks.length);
    expect(ticks.map((tick) => tick.kind)).toEqual(["day", "month", "week"]);
  });

  it("respects fractional visible index ranges", () => {
    const start = Date.UTC(2024, 0, 1);
    const times = Array.from({ length: 10 }, (_, index) => start + index * day);

    const ticks = new TimeTickGenerator().generate({
      times,
      visibleRange: { from: 2.2, to: 6.4 },
      formatter: createFormatter(),
      targetTickCount: 10,
    });

    expect(ticks.map((tick) => tick.index)).toEqual([2, 3, 4, 5, 6]);
  });
});
