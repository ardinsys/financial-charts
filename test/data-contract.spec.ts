import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ControllerType } from "../src/chart/financial-chart";
import { CandlestickController } from "../src/controllers/candle-controller";
import { HLCAreaController } from "../src/controllers/hlc-area-controller";
import { LineController } from "../src/controllers/line-controller";
import {
  getChartContext,
  getChartModel,
  requestChartRedraw
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) charts.pop()?.dispose();
  document.body.innerHTML = "";
});

function createChart(type: ControllerType) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, {
    timeRange: "auto",
    type,
    controllers: [LineController, CandlestickController, HLCAreaController],
    includeDefaultControllers: false,
    stepSize: 60_000,
    maxZoom: 10,
    volume: true,
    locale: "en-US"
  });
  charts.push(chart);
  return chart;
}

describe("chart data contracts", () => {
  it("renders finite close-only coordinates while preserving zero", () => {
    const chart = createChart("line");
    const start = Date.UTC(2024, 0, 1, 9);

    chart.setData([
      { time: start + 60_000, close: null },
      { time: start, close: 0, volume: 0 }
    ]);

    const context = getChartContext(chart, "main");
    vi.mocked(context.moveTo).mockClear();
    requestChartRedraw(chart, "series", true);

    expect(chart.getData()).toEqual([
      { time: start, close: 0, volume: 0 },
      { time: start + 60_000, close: null }
    ]);
    expect(context.moveTo).toHaveBeenCalled();
    expect(
      vi.mocked(context.moveTo).mock.calls.flat().every(Number.isFinite)
    ).toBe(true);
    expect(
      Number.isFinite(getChartModel(chart).getVisibleScale().getYMin())
    ).toBe(true);
    expect(
      Number.isFinite(getChartModel(chart).getVisibleScale().getYMax())
    ).toBe(true);
  });

  it("renders finite OHLC and volume coordinates when every value is zero", () => {
    const chart = createChart("candle");
    const start = Date.UTC(2024, 0, 1, 9);

    chart.setData([
      { time: start, open: 0, high: 0, low: 0, close: 0, volume: 0 },
      { time: start + 60_000, open: null, high: null, low: null, close: null }
    ]);

    const context = getChartContext(chart, "main");
    vi.mocked(context.rect).mockClear();
    requestChartRedraw(chart, "series", true);

    expect(context.rect).toHaveBeenCalled();
    expect(
      vi.mocked(context.rect).mock.calls.flat().every(Number.isFinite)
    ).toBe(true);
    expect(
      getChartModel(chart)
        .getVisibleScale()
        .mapVolToPixel(start, 0, context.canvas).y
    ).toBe(0);
  });

  it("treats incomplete HLC area points as gaps", () => {
    const chart = createChart("hlc-area");
    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData([
      { time: start, high: 2, low: 0, close: null },
      { time: start + 60_000, close: 1 }
    ]);

    expect(() => requestChartRedraw(chart, "series", true)).not.toThrow();
  });

  it("rejects older streaming timestamps without changing data", () => {
    const chart = createChart("line");
    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData([
      { time: start, close: 1 },
      { time: start + 2 * 60_000, close: 3 }
    ]);

    expect(() => chart.updateData({ time: start + 60_000, close: 2 })).toThrow(
      "updateData() requires a timestamp at or after the latest point. Use setData() to apply older corrections."
    );
    expect(chart.getData()).toEqual([
      { time: start, close: 1 },
      { time: start + 2 * 60_000, close: 3 }
    ]);
  });

  it("rejects backward raw timestamps inside the latest mapped bucket", () => {
    const chart = createChart("line");
    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData([{ time: start + 59_000, close: 1 }]);

    expect(() => chart.updateData({ time: start + 30_000, close: 2 })).toThrow(
      "updateData() requires a timestamp at or after the latest point. Use setData() to apply older corrections."
    );
    expect(chart.getData()).toEqual([{ time: start, close: 1 }]);
  });

  it("accepts equal streaming timestamps as latest-bucket duplicates", () => {
    const chart = createChart("line");
    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData([{ time: start, close: 1 }]);

    chart.updateData({ time: start, close: 2 });

    expect(chart.getData()).toEqual([{ time: start, close: 2 }]);
  });

  it("returns a stable owned snapshot of mapped data", () => {
    const chart = createChart("line");
    const point = { time: 65_000, close: 1 };
    const input = [point];

    chart.setData(input);
    const first = chart.getData();
    point.close = 2;
    input.push({ time: 120_000, close: 3 });

    expect(first).toEqual([{ time: 60_000, close: 1 }]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(chart.getData()).toBe(first);
  });

  it("rejects non-finite public input without changing existing data", () => {
    const chart = createChart("line");
    const start = Date.UTC(2024, 0, 1, 9);
    chart.setData([{ time: start, close: 1 }]);

    expect(() =>
      chart.updateData({ time: start + 60_000, close: Number.NaN })
    ).toThrow("ChartData.close must be a finite number when present.");

    expect(chart.getData()).toEqual([{ time: start, close: 1 }]);
  });
});
