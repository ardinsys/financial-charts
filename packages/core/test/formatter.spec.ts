import { afterEach, describe, expect, it, vi } from "vitest";
import { DefaultFormatter } from "../src/chart/formatter";

describe("DefaultFormatter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("formats with an explicit timezone and rebuilds on timezone changes", () => {
    const timestamp = Date.UTC(2024, 0, 2, 3, 4, 5);
    const formatter = new DefaultFormatter({
      locale: "en-US",
      timeZone: "UTC",
    });

    expect(formatter.getTimeZone()).toBe("UTC");
    expect(formatter.formatHour(timestamp)).toBe("3:04 AM");
    expect(formatter.formatTooltipDate(timestamp)).toBe("Jan 2, 2024, 3:04 AM");

    formatter.setTimeZone("America/New_York");

    expect(formatter.getTimeZone()).toBe("America/New_York");
    expect(formatter.formatHour(timestamp)).toBe("10:04 PM");
    expect(formatter.formatTooltipDate(timestamp)).toBe(
      "Jan 1, 2024, 10:04 PM"
    );
  });

  it("formats seconds and sub-minute timestamps", () => {
    const formatter = new DefaultFormatter({
      locale: "en-US",
      timeZone: "UTC",
    });
    const timestamp = Date.UTC(2024, 0, 2, 3, 4, 5, 678);

    expect(formatter.formatSecond(timestamp)).toBe("3:04:05 AM");
    expect(formatter.formatSubMinute(timestamp)).toBe("04:05.678");
  });

  it("accepts custom Intl option sets", () => {
    const formatter = new DefaultFormatter({
      locale: "en-US",
      timeZone: "UTC",
      dateTimeFormatOptions: {
        month: { month: "long" },
      },
      numberFormatOptions: {
        price: {
          style: "currency",
          currency: "USD",
        },
      },
    });

    expect(formatter.formatMonth(Date.UTC(2024, 0, 1))).toBe("January");
    expect(formatter.formatPrice(12.5)).toBe("$12.50");
  });

  it("uses explicit volume rules instead of price-based significance", () => {
    const formatter = new DefaultFormatter({
      locale: "en-US",
      volumeFormatOptions: {
        compactThreshold: 1_000,
        minSignificantFraction: 0.01,
      },
    });

    expect(formatter.formatVolume(999, 100)).toBe("999");
    expect(formatter.formatVolume(1_234_567, 10)).toBe("1.2M");
    expect(formatter.formatVolume(10.25, 1_000)).toBe("10.25");
    expect(formatter.formatVolume(10.001, 1_000)).toBe("10.001");
  });

  it("caches tooltip price formatters by decimal precision", () => {
    const formatter = new DefaultFormatter({ locale: "en-US" });
    const cache = formatter as unknown as {
      tooltipPriceFormatters: Map<number, Intl.NumberFormat>;
    };

    expect(cache.tooltipPriceFormatters.size).toBe(0);
    expect(formatter.formatTooltipPrice(12.345, 2)).toBe("12.35");
    const twoDecimalFormatter = cache.tooltipPriceFormatters.get(2);

    expect(formatter.formatTooltipPrice(67.891, 2)).toBe("67.89");
    expect(formatter.formatTooltipPrice(12.345, 3)).toBe("12.345");

    expect(cache.tooltipPriceFormatters.size).toBe(2);
    expect(cache.tooltipPriceFormatters.get(2)).toBe(twoDecimalFormatter);
  });
});
