import { afterEach, describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";

FinancialChart.registerController(LineController);

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

function createChart(data: ChartData[]) {
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
      stepSize: 60_000,
      maxZoom: 10,
      volume: false,
      locale: "en-US",
    }
  );
  chart.draw(data);
  charts.push(chart);
  return chart;
}

function waitForRedraw() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("MovingAverageIndicator", () => {
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
    chart.draw([
      { time: nextStart, close: 20 },
      { time: nextStart + 60_000, close: 24 },
    ]);
    await waitForRedraw();

    expect(cache.cache.has(start)).toBe(false);
    expect([...cache.cache.keys()]).toEqual([nextStart, nextStart + 60_000]);
  });
});
