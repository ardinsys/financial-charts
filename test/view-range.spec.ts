import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import type { ChartPlugin } from "../src/plugin/chart-plugin";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) charts.pop()?.dispose();
  document.body.innerHTML = "";
});

function createChart(withData = true) {
  const start = Date.UTC(2024, 0, 1, 9);
  const data: ChartData[] = [10, 12, 14, 16, 18, 1_000].map(
    (close, index) => ({ time: start + index * 60_000, close })
  );
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
    locale: "en-US"
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
    onVisibleRangeChanged
  };
  chart.addPlugin(plugin);
  onVisibleRangeChanged.mockClear();
  return onVisibleRangeChanged;
}

describe("visible range contracts", () => {
  it("synchronizes scale, notification, and redraw for logical setters", () => {
    const { chart } = createChart();
    const onVisibleRangeChanged = attachRangeProbe(chart);
    const requestRedraw = vi.spyOn(chart, "requestRedraw");
    const fullRangeMax = chart.getVisibleScale().getYMax();

    chart.setVisibleIndexRange({ from: 0, to: 3 });

    expect(chart.getVisibleLogicalRange()).toEqual({
      from: 0,
      to: 3,
      rightOffset: 0
    });
    expect(chart.getVisibleScale().getYMax()).toBeLessThan(fullRangeMax);
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(requestRedraw).toHaveBeenCalledOnce();
    expect(requestRedraw).toHaveBeenCalledWith([
      "grid",
      "axes",
      "series",
      "indicators",
      "drawings",
      "annotations",
      "crosshair"
    ]);

    chart.setVisibleIndexRange({ from: 0, to: 3 });

    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(requestRedraw).toHaveBeenCalledOnce();
  });

  it("defines rounded ranges and precise fractional windows", () => {
    const { chart, data } = createChart();
    const onVisibleRangeChanged = attachRangeProbe(chart);

    chart.setVisibleTimeRange({
      start: data[1].time,
      end: data[4].time
    });

    expect(chart.getVisibleLogicalRange()).toEqual({
      from: 1,
      to: 4,
      rightOffset: 0
    });
    expect(chart.getVisibleTimeRange()).toEqual({
      start: data[1].time,
      end: data[3].time + 60_000
    });
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();

    chart.setVisibleIndexRange({ from: 1.25, to: 4.25 });
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
    chart.setVisibleIndexRange({ from: 1, to: 5 });
    const onVisibleRangeChanged = attachRangeProbe(chart);
    const requestRedraw = vi.spyOn(chart, "requestRedraw");
    const canvas = chart.getContext("crosshair").canvas;

    canvas.dispatchEvent(
      new PointerEvent("pointerdown", {
        clientX: 300,
        clientY: 100,
        pointerType: "mouse",
        button: 0,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 400,
        clientY: 100,
        bubbles: true
      })
    );
    canvas.dispatchEvent(
      new PointerEvent("pointerup", {
        clientX: 400,
        clientY: 100,
        pointerType: "mouse",
        button: 0,
        bubbles: true
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
        cancelable: true
      })
    );
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(requestRedraw).toHaveBeenCalled();
  });

  it("clamps ranges and rejects non-finite boundaries", () => {
    const { chart } = createChart();
    const fullRange = chart.getVisibleLogicalRange();

    chart.setVisibleIndexRange({ from: 3, to: 2 });
    expect(chart.getVisibleLogicalRange()).toEqual({
      from: 3,
      to: 4,
      rightOffset: 0
    });

    chart.setVisibleIndexRange({ from: -100, to: 100 });
    expect(chart.getVisibleLogicalRange()).toEqual(fullRange);

    expect(() =>
      chart.setVisibleIndexRange({ from: Number.NaN, to: 4 })
    ).toThrow("Visible index range values must be finite.");
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
    const requestRedraw = vi.spyOn(chart, "requestRedraw");
    const logicalRange = chart.getVisibleLogicalRange();
    const timeRange = chart.getVisibleTimeRange();
    const timeWindow = chart.getVisibleTimeWindow();

    chart.setVisibleIndexRange({ from: 10, to: 20 });
    chart.setVisibleTimeRange({ start: 10, end: 20 });
    chart.setVisibleTimeWindow({ start: 10, end: 20 });

    expect(chart.getVisibleLogicalRange()).toEqual(logicalRange);
    expect(chart.getVisibleTimeRange()).toEqual(timeRange);
    expect(chart.getVisibleTimeWindow()).toEqual(timeWindow);
    expect(onVisibleRangeChanged).not.toHaveBeenCalled();
    expect(requestRedraw).not.toHaveBeenCalled();
  });
});
