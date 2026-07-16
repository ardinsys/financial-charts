import { describe, expect, it } from "vitest";
import { type ResolvedChartOptions } from "../src/chart/financial-chart";
import type { ChartControllerContext } from "../src/controllers/controller";
import { FinancialChart } from "../src/chart/default-financial-chart";
import { FinancialChart as CoreFinancialChart } from "../src/chart/core-financial-chart";
import { LineController } from "../src/controllers/line-controller";
import { getChartContext } from "./chart-test-harness";

class AlternateLineController extends LineController {
  static override ID = "alternate-line";
  static receivedOptions: ResolvedChartOptions | undefined;

  constructor(context: ChartControllerContext, options: ResolvedChartOptions) {
    super(context, options);
    AlternateLineController.receivedOptions = options;
  }
}

describe("FinancialChart test harness", () => {
  it("creates and draws a chart with a mocked canvas context", async () => {
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "400px";
    document.body.appendChild(container);

    const start = Date.UTC(2024, 0, 1, 9);
    const chart = new FinancialChart(container, {
      timeRange: {
        start,
        end: start + 2 * 60_000
      },
      type: "line",
      stepSize: 60_000,
      maxZoom: 10,
      volume: false
    });

    chart.setData([
      { time: start, close: 10 },
      { time: start + 60_000, close: 11 },
      { time: start + 120_000, close: 9 }
    ]);

    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(chart.getData()).toHaveLength(3);
    expect(container.querySelectorAll("canvas")).toHaveLength(7);
    expect(getChartContext(chart, "main").canvas.width).toBeGreaterThan(0);
    expect(() => chart.updateOptions({ type: "candle" })).not.toThrow();

    chart.dispose();
  });

  it("keeps controller registrations scoped to the chart instance", () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const lineContainer = document.createElement("div");
    const alternateContainer = document.createElement("div");
    for (const container of [lineContainer, alternateContainer]) {
      container.style.width = "800px";
      container.style.height = "400px";
      document.body.appendChild(container);
    }

    const lineChart = new FinancialChart(lineContainer, {
      timeRange: {
        start,
        end: start + 60_000
      },
      type: "line",
      controllers: [LineController],
      includeDefaultControllers: false,
      stepSize: 60_000,
      maxZoom: 10,
      volume: false
    });
    const alternateChart = new FinancialChart(alternateContainer, {
      timeRange: {
        start,
        end: start + 60_000
      },
      type: "alternate-line",
      controllers: [AlternateLineController],
      includeDefaultControllers: false,
      stepSize: 60_000,
      maxZoom: 10,
      volume: false
    });

    expect(() => lineChart.updateOptions({ type: "alternate-line" })).toThrow(
      "Controller: alternate-line is not registered!"
    );
    expect(() => alternateChart.updateOptions({ type: "line" })).toThrow(
      "Controller: line is not registered!"
    );

    lineChart.registerController(AlternateLineController);
    expect(() =>
      lineChart.updateOptions({ type: "alternate-line" })
    ).not.toThrow();

    lineChart.dispose();
    alternateChart.dispose();
  });

  it("adds custom controllers to the built-in set by default", () => {
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "400px";
    document.body.appendChild(container);

    const chart = new FinancialChart(container, {
      timeRange: "auto",
      type: "alternate-line",
      controllers: [AlternateLineController],
      stepSize: 60_000,
      maxZoom: 10,
      volume: false
    });

    expect(() => chart.updateOptions({ type: "line" })).not.toThrow();
    expect(chart.getOptions().includeDefaultControllers).toBe(true);
    expect(chart.getOptions().controllers.map(({ ID }) => ID)).toEqual(
      expect.arrayContaining(["line", "alternate-line"])
    );
    expect(AlternateLineController.receivedOptions).toMatchObject({
      includeDefaultControllers: true,
      locale: expect.any(String),
      theme: expect.objectContaining({ backgroundColor: expect.any(String) }),
      localeValues: expect.any(Object),
      formatter: expect.any(Object),
      domAdapter: expect.any(Object)
    });

    chart.dispose();
  });

  it("keeps the core chart free of implicit controllers", () => {
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "400px";
    document.body.appendChild(container);

    const chart = new CoreFinancialChart(container, {
      timeRange: "auto",
      type: "line",
      controllers: [LineController],
      stepSize: 60_000,
      maxZoom: 10,
      volume: false
    });

    expect(chart.getOptions().includeDefaultControllers).toBe(false);
    expect(chart.getOptions().controllers.map(({ ID }) => ID)).toEqual([
      "line"
    ]);
    expect(() => chart.updateOptions({ type: "candle" })).toThrow(
      "Controller: candle is not registered!"
    );

    chart.dispose();
  });

  it("returns a stable readonly options snapshot that follows chart updates", () => {
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "400px";
    document.body.appendChild(container);

    const chart = new FinancialChart(container, {
      timeRange: "auto",
      type: "line",
      stepSize: 60_000,
      maxZoom: 10,
      volume: false
    });
    const initial = chart.getOptions();

    expect(chart.getOptions()).toBe(initial);
    expect(Object.prototype.hasOwnProperty.call(initial, "timeZone")).toBe(
      true
    );

    chart.updateOptions({ volume: true });
    expect(chart.getOptions()).not.toBe(initial);
    expect(chart.getOptions().volume).toBe(true);
    expect(chart.getOptions().theme).toBe(initial.theme);
    expect(chart.getOptions().formatter).toBe(initial.formatter);
    expect(chart.getOptions().domAdapter).toBe(initial.domAdapter);

    chart.dispose();
  });
});
