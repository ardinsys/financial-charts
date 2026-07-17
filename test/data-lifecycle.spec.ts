import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import { LineController } from "../src/controllers/line-controller";
import {
  FixedRangeTestIndicator,
  TestIndicator,
} from "../src/indicators/paneled/test-indicator";
import type { ChartPlugin } from "../src/plugin/chart-plugin";
import {
  getChartContext,
  getChartModel,
  getChartRenderer,
  getInternalPanes,
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) charts.pop()?.dispose();
  document.body.innerHTML = "";
});

function createChart() {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, {
    timeRange: "auto",
    type: "line",
    controllers: [LineController],
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US",
  });
  charts.push(chart);
  return chart;
}

describe("chart data lifecycle", () => {
  it("supports stream-first and clear-then-stream updates", () => {
    const chart = createChart();
    const onData = vi.fn();
    const plugin: ChartPlugin = {
      key: "data-probe",
      attach: vi.fn(),
      onData,
    };
    const start = Date.UTC(2024, 0, 1, 9);

    chart.addPlugin(plugin);
    chart.updateData({ time: start + 30_000, close: 10 });

    expect(chart.getData()).toEqual([{ time: start, close: 10 }]);
    expect(onData).toHaveBeenLastCalledWith([{ time: start, close: 10 }]);

    chart.clearData();
    chart.updateData({ time: start + 60_000, close: 11 });

    expect(chart.getData()).toEqual([{ time: start + 60_000, close: 11 }]);
    expect(onData).toHaveBeenLastCalledWith([
      { time: start + 60_000, close: 11 },
    ]);
  });

  it("updates visible derived state before rendering streamed data", () => {
    const chart = createChart();
    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData([
      { time: start, close: 10 },
      { time: start + 60_000, close: 12 },
    ]);

    chart.updateData({ time: start + 60_000, close: 100 });

    expect(getChartModel(chart).getVisibleDataPoints().at(-1)?.close).toBe(100);
    expect(
      getChartModel(chart).getVisibleScale().getYMax()
    ).toBeGreaterThanOrEqual(100);
  });

  it("keeps the visible price range stable across in-range updates", () => {
    const chart = createChart();
    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData(
      Array.from({ length: 200 }, (_, index) => ({
        time: start + index * 60_000,
        close: index % 2 === 0 ? 10 : 20,
      }))
    );
    const scale = getChartModel(chart).getVisibleScale();
    const range = [scale.getYMin(), scale.getYMax()];

    for (let index = 200; index < 300; index += 1) {
      chart.updateData({
        time: start + index * 60_000,
        close: 15,
      });
    }

    expect([scale.getYMin(), scale.getYMax()]).toEqual(range);
  });

  it("updates paneled scales while preserving overridden fixed ranges", async () => {
    const chart = createChart();
    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData([
      { time: start, close: 10 },
      { time: start + 60_000, close: 20 },
    ]);
    const automatic = new TestIndicator();
    const fixed = new FixedRangeTestIndicator();
    chart.addIndicator(automatic);
    chart.addIndicator(fixed);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const automaticPane = getInternalPanes(chart)[1];
    const fixedPane = getInternalPanes(chart)[2];
    const fixedRange = fixedPane.getPriceScale().getRange();

    chart.updateData({ time: start + 60_000, close: 1_000 });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(automaticPane.getPriceScale().getRange().max).toBeGreaterThan(1_000);
    expect(fixedPane.getPriceScale().getRange()).toBe(fixedRange);
  });

  it("clears data-dependent state and rendered chart layers immediately", () => {
    const chart = createChart();
    const start = Date.UTC(2024, 0, 1, 9);
    const data = [
      { time: start, close: 10 },
      { time: start + 60_000, close: 12 },
    ] as const;
    const onData = vi.fn();
    const plugin: ChartPlugin = {
      key: "clear-probe",
      attach: vi.fn(),
      onData,
    };
    const paneledIndicator = new TestIndicator();

    chart.addPlugin(plugin);
    chart.addIndicator(paneledIndicator);
    chart.setData(data);
    chart.setCrosshair({ time: start, price: 10 });

    const visibleScale = getChartModel(chart).getVisibleScale();
    visibleScale.addModifier({
      actor: "clear-probe",
      enabled: true,
      yMin: -100,
      yMax: 100,
    });

    const clearedContexts = [
      getChartContext(chart, "main"),
      getChartContext(chart, "x-label"),
      getChartContext(chart, "y-label"),
      getChartContext(chart, "indicator"),
      getChartContext(chart, "crosshair"),
    ];
    for (const context of clearedContexts) {
      vi.mocked(context.clearRect).mockClear();
    }

    const xGridCoords = getChartRenderer(chart).getLastXGridCoords();
    expect(getChartRenderer(chart).getLastXGridCoords()).toBe(xGridCoords);

    chart.setData([]);

    expect(chart.getData()).toEqual([]);
    expect(getChartModel(chart).getVisibleDataPoints()).toEqual([]);
    expect(getChartRenderer(chart).getLastXGridCoords()).toEqual([]);
    expect(getChartRenderer(chart).getLastXGridCoords()).not.toBe(xGridCoords);
    expect(chart.getCrosshairState()).toBeUndefined();
    expect(chart.getTimeRange()).toEqual({ start: 0, end: 0 });
    expect(getChartModel(chart).getVisibleScale()).toBe(visibleScale);
    expect(visibleScale.getYMin()).toBeGreaterThan(-100);
    expect(Number.isFinite(visibleScale.getYMin())).toBe(true);
    expect(Number.isFinite(visibleScale.getYMax())).toBe(true);
    expect(onData).toHaveBeenLastCalledWith([]);
    for (const context of clearedContexts) {
      expect(context.clearRect).toHaveBeenCalled();
    }
  });
});
