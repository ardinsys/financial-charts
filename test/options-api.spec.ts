import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import { FinancialChart as CoreFinancialChart } from "../src/chart/core-financial-chart";
import type { ChartOptionsChangeEvent } from "../src/chart/financial-chart";
import { LineController } from "../src/controllers/line-controller";
import type { ChartPlugin } from "../src/plugin/chart-plugin";

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
    locale: "en-US"
  });
  const start = Date.UTC(2024, 0, 1, 9);
  chart.setData(
    Array.from({ length: 6 }, (_, index) => ({
      time: start + index * 60_000,
      close: 10 + index
    }))
  );
  charts.push(chart);
  return chart;
}

describe("chart options API", () => {
  it("provides convenient root defaults and core controller inference", () => {
    const root = new FinancialChart(createContainer(), {
      stepSize: 60_000
    });
    const core = new CoreFinancialChart(createContainer(), {
      controllers: [LineController],
      stepSize: 60_000
    });
    charts.push(root, core);

    expect(root.getOptions()).toMatchObject({
      type: "candle",
      timeRange: "auto",
      maxZoom: 100,
      volume: true
    });
    expect(core.getOptions()).toMatchObject({
      type: "line",
      timeRange: "auto",
      maxZoom: 100,
      volume: true,
      includeDefaultControllers: false
    });
  });

  it("does nothing when a patch has no effective changes", () => {
    const chart = createChart();
    const redraw = vi.spyOn(chart, "requestRedraw");
    const listener = vi.fn();
    chart.on("options-change", listener);
    const visibleRange = chart.getVisibleLogicalRange();

    chart.updateOptions({
      type: "line",
      timeRange: "auto",
      stepSize: 60_000,
      maxZoom: 10,
      volume: true,
      locale: "en-US"
    });

    expect(redraw).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(chart.getVisibleLogicalRange()).toEqual(visibleRange);
  });

  it("applies a multi-option patch with one redraw and one typed event", () => {
    const chart = createChart();
    const redraw = vi.spyOn(chart, "requestRedraw");
    const events: ChartOptionsChangeEvent[] = [];
    chart.on("options-change", (event) => events.push(event));

    chart.updateOptions({
      type: "candle",
      theme: { key: "custom", backgroundColor: "#123456" },
      locale: "hu-HU",
      volume: false
    });

    expect(redraw).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1);
    expect(events[0].changedKeys).toEqual([
      "type",
      "volume",
      "theme",
      "locale"
    ]);
    expect(events[0].previous).toMatchObject({
      type: "line",
      volume: true,
      locale: "en-US"
    });
    expect(events[0].current).toMatchObject({
      type: "candle",
      volume: false,
      locale: "hu-HU",
      theme: { key: "custom", backgroundColor: "#123456" }
    });
    expect(Object.isFrozen(events[0].current.theme)).toBe(true);
    expect(
      chart.getOutsideContainer().querySelector(".financial-charts-custom")
    ).not.toBeNull();
  });

  it("remaps data and resets the view only for core option changes", () => {
    const chart = createChart();
    const onData = vi.fn();
    const onVisibleRangeChanged = vi.fn();
    const plugin: ChartPlugin = {
      key: "options-probe",
      attach: vi.fn(),
      onData,
      onVisibleRangeChanged
    };
    chart.addPlugin(plugin);
    chart.setVisibleIndexRange({ from: 1.25, to: 4.25 });
    onData.mockClear();
    onVisibleRangeChanged.mockClear();

    chart.updateOptions({ stepSize: 120_000 });

    expect(chart.getData()).toHaveLength(3);
    expect(chart.getVisibleLogicalRange()).not.toEqual({
      from: 1.25,
      to: 4.25
    });
    expect(onData).toHaveBeenCalledTimes(1);
    expect(onVisibleRangeChanged).toHaveBeenCalledTimes(1);

    const visibleRange = chart.getVisibleLogicalRange();
    const redraw = vi.spyOn(chart, "requestRedraw");
    onData.mockClear();
    onVisibleRangeChanged.mockClear();
    chart.updateOptions({ maxZoom: 20 });

    expect(chart.getVisibleLogicalRange()).toEqual(visibleRange);
    expect(redraw).not.toHaveBeenCalled();
    expect(onData).not.toHaveBeenCalled();
    expect(onVisibleRangeChanged).not.toHaveBeenCalled();
  });

  it("validates a patch before changing chart state", () => {
    const chart = createChart();
    const initial = chart.getOptions();
    const listener = vi.fn();
    chart.on("options-change", listener);

    expect(() =>
      chart.updateOptions({
        stepSize: 0,
        volume: false
      })
    ).toThrow("stepSize must be a finite number greater than zero.");
    expect(chart.getOptions()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps convenience methods as updateOptions delegates", () => {
    const chart = createChart();
    const updateOptions = vi
      .spyOn(chart, "updateOptions")
      .mockImplementation(() => undefined);

    chart.changeType("candle");
    chart.updateTheme({ key: "custom" });
    chart.setVolumeDraw(false);
    chart.updateLocalization({ locale: "hu-HU" });
    chart.updateLocale("de-DE");

    expect(updateOptions.mock.calls).toEqual([
      [{ type: "candle" }],
      [{ theme: { key: "custom" } }],
      [{ volume: false }],
      [{ locale: "hu-HU" }],
      [{ locale: "de-DE", localeValues: undefined }]
    ]);
  });
});
