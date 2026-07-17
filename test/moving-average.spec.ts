import { afterEach, describe, expect, it } from "vitest";
import { DefaultFormatter } from "../src/chart/formatter";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import { getChartContext } from "./chart-test-harness";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

function createChart(
  data: ChartData[],
  overrides: Partial<ConstructorParameters<typeof FinancialChart>[1]> = {}
) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const start = data[0].time;
  const chart = new FinancialChart(container, {
    timeRange: {
      start,
      end: data.at(-1)!.time + 60_000,
    },
    type: "line",
    controllers: [LineController],
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US",
    ...overrides,
  });
  chart.setData(data);
  charts.push(chart);
  return chart;
}

function waitForRedraw() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("MovingAverageIndicator", () => {
  it("updates locale strings and formatter timezone together", async () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const formatter = new DefaultFormatter({
      locale: "en-US",
      timeZone: "UTC",
    });
    const chart = createChart(
      [
        { time: start, close: 10 },
        { time: start + 60_000, close: 12 },
        { time: start + 120_000, close: 14 },
      ],
      { formatter, timeZone: "UTC" }
    );
    const indicator = new MovingAverageIndicator();

    chart.addIndicator(indicator);
    await waitForRedraw();

    expect(chart.getOptions().timeZone).toBe("UTC");
    expect(chart.getOptions().formatter.getTimeZone?.()).toBe("UTC");
    expect(
      indicator.getLabelContainer().querySelector("[data-id=extra]")
        ?.textContent
    ).toBe("5 close");

    chart.updateOptions({
      locale: "hu-HU",
      timeZone: "Europe/Budapest",
      localeValues: {
        "hu-HU": {
          common: {
            sources: {
              open: "nyitó",
              high: "magas",
              low: "alacsony",
              close: "záró",
              volume: "volumen",
            },
          },
          indicators: {
            actions: {
              show: "Megjelenítés",
              hide: "Elrejtés",
              settings: "Beállítások",
              remove: "Törlés",
            },
          },
        },
      },
    });

    expect(chart.getOptions().locale).toBe("hu-HU");
    expect(chart.getOptions().timeZone).toBe("Europe/Budapest");
    expect(chart.getOptions().formatter.getLocale()).toBe("hu-HU");
    expect(chart.getOptions().formatter.getTimeZone?.()).toBe(
      "Europe/Budapest"
    );
    expect(
      indicator.getLabelContainer().querySelector("[data-id=extra]")
        ?.textContent
    ).toBe("5 záró");
    expect(
      (
        indicator
          .getLabelContainer()
          .querySelector("[data-id=settings]") as HTMLButtonElement
      ).title
    ).toBe("Beállítások");
  });

  it("can replace the formatter at runtime", () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart([
      { time: start, close: 10 },
      { time: start + 60_000, close: 12 },
      { time: start + 120_000, close: 14 },
    ]);
    const formatter = new DefaultFormatter({
      locale: "de-DE",
      timeZone: "Europe/Berlin",
    });

    chart.updateOptions({ formatter });

    expect(chart.getOptions().formatter).toBe(formatter);
    expect(chart.getOptions().locale).toBe("de-DE");
    expect(chart.getOptions().timeZone).toBe("Europe/Berlin");
    expect(chart.getOptions().formatter.getLocale()).toBe("de-DE");

    chart.updateOptions({ timeZone: "Europe/Budapest" });

    expect(chart.getOptions().formatter.getTimeZone?.()).toBe(
      "Europe/Budapest"
    );
  });

  it("uses its configured theme color for the line stroke", async () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart([
      { time: start, close: 10 },
      { time: start + 60_000, close: 12 },
      { time: start + 120_000, close: 14 },
    ]);
    const indicator = new MovingAverageIndicator({
      light: { color: "#ff00aa" },
    });

    chart.addIndicator(indicator);
    await waitForRedraw();

    expect(getChartContext(chart, "indicator").strokeStyle).toBe("#ff00aa");
  });

  it("clears stale per-time cache entries when chart data is replaced", async () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart([
      { time: start, close: 10 },
      { time: start + 60_000, close: 12 },
      { time: start + 120_000, close: 14 },
    ]);
    const indicator = new MovingAverageIndicator(null, { period: 2 });
    const cache = indicator as unknown as {
      cache: Map<number, number>;
    };

    chart.addIndicator(indicator);
    await waitForRedraw();
    expect(cache.cache.has(start)).toBe(true);

    const nextStart = start + 60_000;
    chart.setData([
      { time: nextStart, close: 20 },
      { time: nextStart + 60_000, close: 24 },
    ]);
    await waitForRedraw();

    expect(cache.cache.has(start)).toBe(false);
    expect([...cache.cache.keys()]).toEqual([nextStart, nextStart + 60_000]);
  });

  it("uses only present values in a trailing window containing gaps", async () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart([
      { time: start, close: 10 },
      { time: start + 60_000 },
      { time: start + 120_000, close: 20 },
      { time: start + 180_000, close: 30 }
    ]);
    const indicator = new MovingAverageIndicator(null, { period: 3 });
    const cache = indicator as unknown as { cache: Map<number, number> };

    chart.addIndicator(indicator);
    await waitForRedraw();

    expect(cache.cache.get(start)).toBe(10);
    expect(cache.cache.has(start + 60_000)).toBe(false);
    expect(cache.cache.get(start + 120_000)).toBe(15);
    expect(cache.cache.get(start + 180_000)).toBe(25);
  });
});
