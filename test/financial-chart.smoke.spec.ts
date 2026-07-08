import { describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/financial-chart";
import { LineController } from "../src/controllers/line-controller";

FinancialChart.registerController(LineController);

describe("FinancialChart test harness", () => {
  it("creates and draws a chart with a mocked canvas context", async () => {
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "400px";
    document.body.appendChild(container);

    const start = Date.UTC(2024, 0, 1, 9);
    const chart = new FinancialChart(
      container,
      {
        start,
        end: start + 2 * 60_000
      },
      {
        type: "line",
        stepSize: 60_000,
        maxZoom: 10,
        volume: false
      }
    );

    chart.draw([
      { time: start, close: 10 },
      { time: start + 60_000, close: 11 },
      { time: start + 120_000, close: 9 }
    ]);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(chart.getData()).toHaveLength(3);
    expect(container.querySelectorAll("canvas")).toHaveLength(6);
    expect(chart.getContext("main").canvas.width).toBeGreaterThan(0);

    chart.dispose();
  });
});
