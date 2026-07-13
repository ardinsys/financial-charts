import { afterEach, describe, expect, it } from "vitest";
import { DefaultFormatter } from "../src/chart/formatter";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

function createChart(
  data: ChartData[],
  overrides: Partial<ConstructorParameters<typeof FinancialChart>[2]> = {},
) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const start = data[0].time;
  const chart = new FinancialChart(
    container,
    {
      start,
      end: data.at(-1)!.time + 60_000,
    },
    {
      type: "line",
      controllers: [LineController],
      stepSize: 60_000,
      maxZoom: 10,
      volume: false,
      locale: "en-US",
      ...overrides,
    },
  );
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
      { formatter, timeZone: "UTC" },
    );
    const indicator = new MovingAverageIndicator();

    chart.addIndicator(indicator);
    await waitForRedraw();

    expect(chart.getOptions().timeZone).toBe("UTC");
    expect(chart.getFormatter().getTimeZone?.()).toBe("UTC");
    expect(
      indicator.getLabelContainer().querySelector("[data-id=extra]")
        ?.textContent,
    ).toBe("5 close");

    chart.updateLocalization({
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
    expect(chart.getFormatter().getLocale()).toBe("hu-HU");
    expect(chart.getFormatter().getTimeZone?.()).toBe("Europe/Budapest");
    expect(
      indicator.getLabelContainer().querySelector("[data-id=extra]")
        ?.textContent,
    ).toBe("5 záró");
    expect(
      (
        indicator
          .getLabelContainer()
          .querySelector("[data-id=settings]") as HTMLButtonElement
      ).title,
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

    chart.updateLocalization({ formatter });

    expect(chart.getFormatter()).toBe(formatter);
    expect(chart.getOptions().locale).toBe("de-DE");
    expect(chart.getOptions().timeZone).toBe("Europe/Berlin");
    expect(chart.getFormatter().getLocale()).toBe("de-DE");

    chart.updateLocalization({ timeZone: "Europe/Budapest" });

    expect(chart.getFormatter().getTimeZone?.()).toBe("Europe/Budapest");
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

    expect(chart.getContext("indicator").strokeStyle).toBe("#ff00aa");
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
});
