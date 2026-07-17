import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import { FinancialChart as CoreFinancialChart } from "../src/chart/core-financial-chart";
import type { ChartOptionsChangeEvent } from "../src/chart/financial-chart";
import { LineController } from "../src/controllers/line-controller";
import type { ChartPlugin } from "../src/plugin/chart-plugin";
import { getChartContext, getChartRenderer } from "./chart-test-harness";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) charts.pop()?.dispose();
  document.body.innerHTML = "";
});

function createContainer() {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);
  return container;
}

function createChart() {
  const chart = new FinancialChart(createContainer(), {
    type: "line",
    timeRange: "auto",
    stepSize: 60_000,
    maxZoom: 10,
    volume: true,
    locale: "en-US",
    themes: {
      custom: { base: "dark", backgroundColor: "#123456" },
    },
  });
  const start = Date.UTC(2024, 0, 1, 9);
  chart.setData(
    Array.from({ length: 6 }, (_, index) => ({
      time: start + index * 60_000,
      close: 10 + index,
    }))
  );
  charts.push(chart);
  return chart;
}

describe("chart options API", () => {
  it("applies a custom theme's resolved base class to the chart DOM", () => {
    const chart = createChart();
    const root = getChartContext(chart, "main").canvas.closest(
      ".financial-charts"
    )!;

    expect(root.classList.contains("financial-charts-light")).toBe(true);

    chart.updateOptions({ theme: "custom" });

    expect(root.classList.contains("financial-charts-custom")).toBe(true);
    expect(root.classList.contains("financial-charts-dark")).toBe(true);
    expect(root.classList.contains("financial-charts-light")).toBe(false);

    chart.updateOptions({ theme: "light" });

    expect(root.classList.contains("financial-charts-light")).toBe(true);
    expect(root.classList.contains("financial-charts-custom")).toBe(false);
    expect(root.classList.contains("financial-charts-dark")).toBe(false);
  });

  it("provides convenient root defaults and core controller inference", () => {
    const root = new FinancialChart(createContainer(), {
      stepSize: 60_000,
    });
    const core = new CoreFinancialChart(createContainer(), {
      controllers: [LineController],
      stepSize: 60_000,
    });
    charts.push(root, core);

    expect(root.getOptions()).toMatchObject({
      type: "candle",
      timeRange: "auto",
      maxZoom: 100,
      volume: true,
    });
    expect(core.getOptions()).toMatchObject({
      type: "line",
      timeRange: "auto",
      maxZoom: 100,
      volume: true,
      includeDefaultControllers: false,
    });
  });

  it("does nothing when a patch has no effective changes", () => {
    const chart = createChart();
    const redraw = vi.spyOn(getChartRenderer(chart), "requestRedraw");
    const listener = vi.fn();
    chart.on("options-change", listener);
    const visibleRange = chart.getVisibleLogicalRange();

    chart.updateOptions({
      type: "line",
      timeRange: "auto",
      stepSize: 60_000,
      maxZoom: 10,
      volume: true,
      locale: "en-US",
    });

    expect(redraw).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(chart.getVisibleLogicalRange()).toEqual(visibleRange);
  });

  it("applies a multi-option patch with one redraw and one typed event", () => {
    const chart = createChart();
    const redraw = vi.spyOn(getChartRenderer(chart), "requestRedraw");
    const events: ChartOptionsChangeEvent[] = [];
    const previousOptions = chart.getOptions();
    chart.on("options-change", (event) => events.push(event));

    chart.updateOptions({
      type: "candle",
      theme: "custom",
      locale: "hu-HU",
      volume: false,
    });

    expect(redraw).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0].changedKeys).toEqual([
      "type",
      "volume",
      "theme",
      "locale",
    ]);
    expect(events[0].previous).toBe(previousOptions);
    expect(events[0].current).toBe(chart.getOptions());
    expect(events[0].current.formatter).toBe(chart.getOptions().formatter);
    expect(events[0].previous).toMatchObject({
      type: "line",
      volume: true,
      locale: "en-US",
    });
    expect(events[0].current).toMatchObject({
      type: "candle",
      volume: false,
      locale: "hu-HU",
      theme: { key: "custom", backgroundColor: "#123456" },
    });
    expect(
      getChartContext(chart, "main").canvas.closest(".financial-charts-custom")
    ).not.toBeNull();
  });

  it("redraws an empty chart when its theme changes", async () => {
    const chart = new FinancialChart(createContainer(), {
      stepSize: 60_000,
      theme: "light",
      themes: {
        custom: { backgroundColor: "#123456" },
      },
    });
    charts.push(chart);
    const main = getChartContext(chart, "main");
    const xAxis = getChartContext(chart, "x-label");
    vi.mocked(main.fillRect).mockClear();
    vi.mocked(xAxis.clearRect).mockClear();

    chart.updateOptions({ theme: "custom" });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(main.fillRect).toHaveBeenCalled();
    expect(xAxis.clearRect).toHaveBeenCalled();
  });

  it("clears the main canvas when volume is toggled", async () => {
    const chart = createChart();
    const main = getChartContext(chart, "main");
    vi.mocked(main.clearRect).mockClear();

    chart.updateOptions({ volume: false });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(main.clearRect).toHaveBeenCalledOnce();

    vi.mocked(main.clearRect).mockClear();
    vi.mocked(main.fill).mockClear();
    chart.updateOptions({ volume: true });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(main.clearRect).toHaveBeenCalledOnce();
    expect(main.fill).toHaveBeenCalled();
  });

  it("owns retained option values without retaining caller mutations", () => {
    const timeRange = { start: 100, end: 400 };
    const themes = {
      owned: {
        randomColors: ["#123456"],
        line: { color: "#abcdef" },
      },
      updated: { randomColors: ["#fedcba"] },
    };
    const localeValues = {
      "en-US": {
        indicators: {
          actions: {
            show: "Show",
            hide: "Hide",
            settings: "Settings",
            remove: "Remove",
          },
        },
        common: {
          sources: {
            open: "open",
            high: "high",
            low: "low",
            close: "closing",
            volume: "volume",
          },
        },
      },
    };
    const chart = new FinancialChart(createContainer(), {
      type: "line",
      timeRange,
      stepSize: 60_000,
      locale: "en-US",
      theme: "owned",
      themes,
      localeValues,
    });
    charts.push(chart);
    const initial = chart.getOptions();

    timeRange.start = -100;
    themes.owned.randomColors[0] = "#000000";
    themes.owned.line.color = "#000000";
    themes.updated.randomColors[0] = "#000000";
    localeValues["en-US"].common.sources.close = "mutated";

    expect(initial.timeRange).toEqual({ start: 100, end: 400 });
    expect(initial.theme.randomColors).toEqual(["#123456"]);
    expect(initial.theme.line.color).toBe("#abcdef");
    expect(initial.localeValues["en-US"].common.sources.close).toBe("closing");

    chart.updateOptions({ theme: "updated" });
    const updated = chart.getOptions();

    expect(updated.theme.randomColors).toEqual(["#fedcba"]);

    chart.updateOptions({ theme: "updated" });
    expect(chart.getOptions()).toBe(updated);
  });

  it("remaps data and resets the view only for core option changes", () => {
    const chart = createChart();
    const onData = vi.fn();
    const onVisibleRangeChanged = vi.fn(() => chart.getOptions());
    const plugin: ChartPlugin = {
      key: "options-probe",
      attach: vi.fn(),
      onData,
      onVisibleRangeChanged,
    };
    chart.addPlugin(plugin);
    chart.setVisibleLogicalRange({ from: 1.25, to: 4.25 });
    onData.mockClear();
    onVisibleRangeChanged.mockClear();

    chart.updateOptions({ stepSize: 120_000 });

    expect(chart.getData()).toHaveLength(3);
    expect(chart.getVisibleLogicalRange()).not.toEqual({
      from: 1.25,
      to: 4.25,
    });
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onVisibleRangeChanged).toHaveBeenCalledTimes(1);
    expect(onVisibleRangeChanged.mock.results[0].value).toBe(
      chart.getOptions()
    );
    expect(chart.getOptions().stepSize).toBe(120_000);

    const visibleRange = chart.getVisibleLogicalRange();
    const redraw = vi.spyOn(getChartRenderer(chart), "requestRedraw");
    onData.mockClear();
    onVisibleRangeChanged.mockClear();
    chart.updateOptions({ maxZoom: 20 });

    expect(chart.getVisibleLogicalRange()).toEqual(visibleRange);
    expect(redraw).not.toHaveBeenCalled();
    expect(onData).not.toHaveBeenCalled();
    expect(onVisibleRangeChanged).not.toHaveBeenCalled();
  });

  it("commits option, data, range, and redraw effects in one order", () => {
    const chart = createChart();
    const order: string[] = [];
    const plugin: ChartPlugin = {
      key: "change-order-probe",
      attach: vi.fn(),
      onOptionsChanged: () => order.push("extension-options"),
      onData: () => order.push("data"),
      onVisibleRangeChanged: () => order.push("range"),
    };
    chart.addPlugin(plugin);
    chart.on("options-change", () => order.push("public-options"));
    const redraw = vi
      .spyOn(getChartRenderer(chart), "requestRedraw")
      .mockImplementation(() => order.push("redraw"));
    order.length = 0;

    chart.updateOptions({ stepSize: 120_000 });

    expect(order).toEqual([
      "extension-options",
      "data",
      "range",
      "public-options",
      "redraw",
    ]);

    redraw.mockRestore();
  });

  it("commits replacement data before its derived range and redraw", () => {
    const chart = createChart();
    const order: string[] = [];
    const plugin: ChartPlugin = {
      key: "data-change-order-probe",
      attach: vi.fn(),
      onData: () => order.push("data"),
      onVisibleRangeChanged: () => order.push("range"),
    };
    chart.addPlugin(plugin);
    chart.setVisibleLogicalRange({ from: 1, to: 3 });
    const redraw = vi
      .spyOn(getChartRenderer(chart), "requestRedraw")
      .mockImplementation(() => order.push("redraw"));
    order.length = 0;

    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData(
      Array.from({ length: 8 }, (_, index) => ({
        time: start + index * 60_000,
        close: 20 + index,
      }))
    );

    expect(order).toEqual(["data", "range", "redraw"]);

    redraw.mockRestore();
  });

  it("validates a patch before changing chart state", () => {
    const chart = createChart();
    const initial = chart.getOptions();
    const listener = vi.fn();
    chart.on("options-change", listener);

    expect(() =>
      chart.updateOptions({
        stepSize: 0,
        volume: false,
      })
    ).toThrow("stepSize must be a finite number greater than zero.");
    expect(chart.getOptions()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
  });
});
