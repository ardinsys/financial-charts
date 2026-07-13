import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import { LineController } from "../src/controllers/line-controller";
import { TestIndicator } from "../src/indicators/paneled/test-indicator";
import type { ChartPlugin } from "../src/plugin/chart-plugin";

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

  const chart = new FinancialChart(container, "auto", {
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

    const visibleScale = chart.getVisibleScale();
    visibleScale.addModifier({
      actor: "clear-probe",
      enabled: true,
      yMin: -100,
      yMax: 100,
    });

    const clearedContexts = [
      chart.getContext("main"),
      chart.getContext("x-label"),
      chart.getContext("y-label"),
      chart.getContext("indicator"),
      chart.getContext("crosshair"),
    ];
    for (const context of clearedContexts) {
      vi.mocked(context.clearRect).mockClear();
    }

    chart.setData([]);

    expect(chart.getData()).toEqual([]);
    expect(chart.getLastVisibleDataPoints()).toEqual([]);
    expect(chart.getLastXGridCoords()).toEqual([]);
    expect(chart.getCrosshairState()).toBeUndefined();
    expect(chart.getTimeRange()).toEqual({ start: 0, end: 0 });
    expect(chart.getVisibleScale()).toBe(visibleScale);
    expect(visibleScale.getYMin()).toBeGreaterThan(-100);
    expect(Number.isFinite(visibleScale.getYMin())).toBe(true);
    expect(Number.isFinite(visibleScale.getYMax())).toBe(true);
    expect(onData).toHaveBeenLastCalledWith([]);
    for (const context of clearedContexts) {
      expect(context.clearRect).toHaveBeenCalled();
    }
  });

  it("keeps deprecated data methods as delegating migration aliases", () => {
    const chart = createChart();
    const start = Date.UTC(2024, 0, 1, 9);
    const setData = vi.spyOn(chart, "setData");
    const updateData = vi.spyOn(chart, "updateData");

    chart.draw([{ time: start, close: 10 }]);
    chart.drawNextPoint({ time: start + 60_000, close: 11 });

    expect(setData).toHaveBeenCalledOnce();
    expect(updateData).toHaveBeenCalledOnce();
    expect(chart.getData()).toHaveLength(2);
  });
});
