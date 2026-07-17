import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import type { ChartPlugin } from "../src/plugin/chart-plugin";
import {
  getChartContext,
  getChartModel,
  getChartRenderer,
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) charts.pop()?.dispose();
  document.body.innerHTML = "";
});

function createChart(withData = true) {
  const start = Date.UTC(2024, 0, 1, 9);
  const data: ChartData[] = [10, 12, 14, 16, 18, 1_000].map((close, index) => ({
    time: start + index * 60_000,
    close,
  }));
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
  if (withData) chart.setData(data);
  charts.push(chart);
  return { chart, data };
}

function attachRangeProbe(chart: FinancialChart) {
  const onVisibleRangeChanged = vi.fn();
  const plugin: ChartPlugin = {
    key: "range-probe",
    attach: vi.fn(),
    onVisibleRangeChanged,
  };
  chart.addPlugin(plugin);
  onVisibleRangeChanged.mockClear();
  return onVisibleRangeChanged;
}

describe("visible range contracts", () => {
  it("synchronizes scale, notification, and redraw for logical setters", () => {
    const { chart } = createChart();
    const onVisibleRangeChanged = attachRangeProbe(chart);
    const onVisibleRangeChange = vi.fn();
    chart.on("visible-range-change", onVisibleRangeChange);
    const requestRedraw = vi.spyOn(getChartRenderer(chart), "requestRedraw");
    const model = getChartModel(chart);
    const refreshIndexBounds = vi.spyOn(model, "refreshIndexBounds");
    const fullRangeMax = model.getVisibleScale().getYMax();

    chart.setVisibleLogicalRange({ from: 0, to: 3 });

    expect(chart.getVisibleLogicalRange()).toEqual({
      from: 0,
      to: 3,
    });
    expect(getChartModel(chart).getVisibleScale().getYMax()).toBeLessThan(
      fullRangeMax
    );
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(onVisibleRangeChange).toHaveBeenCalledWith(
      chart.getVisibleTimeRange()
    );
    expect(requestRedraw).toHaveBeenCalledOnce();
    expect(requestRedraw).toHaveBeenCalledWith(
      [
        "grid",
        "axes",
        "series",
        "indicators",
        "drawings",
        "annotations",
        "crosshair",
      ],
      false
    );
    expect(refreshIndexBounds).not.toHaveBeenCalled();

    chart.setVisibleLogicalRange({ from: 0, to: 3 });

    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(onVisibleRangeChange).toHaveBeenCalledOnce();
    expect(requestRedraw).toHaveBeenCalledOnce();
  });

  it("reuses axis labels and pointer bounds until their inputs change", () => {
    const { chart } = createChart();
    const renderer = getChartRenderer(chart) as unknown as {
      calculateYAxisLabels(spacing: number): readonly unknown[];
    };
    const firstLabels = renderer.calculateYAxisLabels(30);
    expect(renderer.calculateYAxisLabels(30)).toBe(firstLabels);

    chart.setVisibleLogicalRange({ from: 0, to: 3 });
    expect(renderer.calculateYAxisLabels(30)).not.toBe(firstLabels);

    const canvas = getChartContext(chart, "crosshair").canvas;
    const getBounds = vi.spyOn(canvas, "getBoundingClientRect");
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 120,
        clientY: 100,
        bubbles: true,
      })
    );
    expect(getBounds).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event("scroll"));
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 140,
        clientY: 100,
        bubbles: true,
      })
    );
    expect(getBounds).toHaveBeenCalledTimes(2);
  });

  it("defines rounded ranges and precise fractional windows", () => {
    const { chart, data } = createChart();
    const onVisibleRangeChanged = attachRangeProbe(chart);

    chart.setVisibleTimeRange({
      start: data[1].time,
      end: data[4].time,
    });

    expect(chart.getVisibleLogicalRange()).toEqual({
      from: 1,
      to: 4,
    });
    expect(chart.getVisibleTimeRange()).toEqual({
      start: data[1].time,
      end: data[3].time + 60_000,
    });
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();

    chart.setVisibleLogicalRange({ from: 1.25, to: 4.25 });
    const logicalRange = chart.getVisibleLogicalRange();
    const preciseWindow = chart.getVisibleTimeWindow();
    onVisibleRangeChanged.mockClear();

    chart.setVisibleTimeWindow(preciseWindow);

    expect(chart.getVisibleLogicalRange().from).toBeCloseTo(
      logicalRange.from,
      10
    );
    expect(chart.getVisibleLogicalRange().to).toBeCloseTo(logicalRange.to, 10);
    expect(onVisibleRangeChanged).not.toHaveBeenCalled();
  });

  it("uses the same completed mutation for pointer pan and zoom", () => {
    const { chart } = createChart();
    chart.setVisibleLogicalRange({ from: 1, to: 5 });
    const onVisibleRangeChanged = attachRangeProbe(chart);
    const requestRedraw = vi.spyOn(getChartRenderer(chart), "requestRedraw");
    const canvas = getChartContext(chart, "crosshair").canvas;

    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 300,
        clientY: 100,
        pointerType: "mouse",
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 400,
        clientY: 100,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: 400,
        clientY: 100,
        pointerType: "mouse",
        button: 0,
        bubbles: true,
      })
    );
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(requestRedraw).toHaveBeenCalled();

    onVisibleRangeChanged.mockClear();
    requestRedraw.mockClear();
    canvas.dispatchEvent(
      new WheelEvent("wheel", {
        clientX: 400,
        clientY: 100,
        deltaY: -1,
        bubbles: true,
        cancelable: true,
      })
    );
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(requestRedraw).toHaveBeenCalled();
  });

  it("keeps click semantics for sub-threshold pointer movement", () => {
    const { chart } = createChart();
    const canvas = getChartContext(chart, "crosshair").canvas;
    const clicked = vi.fn();
    chart.on("click", clicked);

    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 200,
        clientY: 100,
        pointerId: 4,
        pointerType: "mouse",
        button: 0,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 201,
        clientY: 101,
        bubbles: true,
      })
    );
    canvas.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: 201,
        clientY: 101,
        pointerId: 4,
        pointerType: "mouse",
        button: 0,
        bubbles: true,
      })
    );

    expect(clicked).toHaveBeenCalledOnce();
  });

  it("clamps ranges and rejects non-finite boundaries", () => {
    const { chart } = createChart();
    const fullRange = chart.getVisibleLogicalRange();

    chart.setVisibleLogicalRange({ from: 3, to: 2 });
    expect(chart.getVisibleLogicalRange()).toEqual({
      from: 3,
      to: 4,
    });

    chart.setVisibleLogicalRange({ from: -100, to: 100 });
    expect(chart.getVisibleLogicalRange()).toEqual(fullRange);

    expect(() =>
      chart.setVisibleLogicalRange({ from: Number.NaN, to: 4 })
    ).toThrow("Visible logical range values must be finite.");
    expect(() =>
      chart.setVisibleTimeRange({ start: 0, end: Number.POSITIVE_INFINITY })
    ).toThrow("Visible time range values must be finite.");
    expect(() =>
      chart.setVisibleTimeWindow({ start: Number.NaN, end: 0 })
    ).toThrow("Visible time range values must be finite.");
  });

  it("makes every view setter a no-op while data is empty", () => {
    const { chart } = createChart(false);
    const onVisibleRangeChanged = attachRangeProbe(chart);
    const requestRedraw = vi.spyOn(getChartRenderer(chart), "requestRedraw");
    const logicalRange = chart.getVisibleLogicalRange();
    const timeRange = chart.getVisibleTimeRange();
    const timeWindow = chart.getVisibleTimeWindow();

    chart.setVisibleLogicalRange({ from: 10, to: 20 });
    chart.setVisibleTimeRange({ start: 10, end: 20 });
    chart.setVisibleTimeWindow({ start: 10, end: 20 });

    expect(chart.getVisibleLogicalRange()).toEqual(logicalRange);
    expect(chart.getVisibleTimeRange()).toEqual(timeRange);
    expect(chart.getVisibleTimeWindow()).toEqual(timeWindow);
    expect(onVisibleRangeChanged).not.toHaveBeenCalled();
    expect(requestRedraw).not.toHaveBeenCalled();
  });
});
