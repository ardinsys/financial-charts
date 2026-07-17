import { afterEach, describe, expect, it } from "vitest";
import { DefaultFormatter } from "../src/chart/formatter";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { AxisLabel, ChartData, TimeRange } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import {
  calculateStepSize,
  calculateYAxisLabels
} from "../src/scales/ticks/price-ticks";
import {
  getChartContext,
  getChartModel,
  getChartRenderer,
  requestChartRedraw
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

function createChart(
  data: ChartData[],
  timeRange: TimeRange,
  overrides: Partial<ConstructorParameters<typeof FinancialChart>[1]> = {}
) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, {
    timeRange,
    type: "line",
    controllers: [LineController],
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US",
    ...overrides
  });

  chart.setData(data);
  charts.push(chart);
  return chart;
}

function roundedLabels(labels: AxisLabel[]) {
  return labels.map((label) => ({
    value: label.value,
    position: Number(label.position.toFixed(6))
  }));
}

function getFillTextLabels(chart: FinancialChart) {
  const fillText = getChartContext(chart, "x-label").fillText as unknown as {
    mock: { calls: unknown[][]; clear: () => void };
    mockClear: () => void;
  };
  fillText.mockClear();
  requestChartRedraw(chart, "axes", true);
  return fillText.mock.calls.map((call) => call[0]);
}

function getCrosshairPriceLabel(
  chart: FinancialChart,
  time: number,
  price: number
) {
  const fillText = getChartContext(chart, "crosshair").fillText as unknown as {
    mock: { calls: unknown[][] };
    mockClear(): void;
  };
  fillText.mockClear();
  chart.setCrosshair({ time, price });
  requestChartRedraw(chart, "crosshair", true);
  return fillText.mock.calls[1]?.[0];
}

describe("current price tick calculations", () => {
  it("keeps the existing nice step-size rounding", () => {
    expect(calculateStepSize(8.1, 8)).toBe(1);
    expect(calculateStepSize(0.12, 5)).toBe(0.02);
    expect(calculateStepSize(0.008, 8)).toBe(0.001);
    expect(calculateStepSize(982, 6)).toBe(200);
  });

  it("keeps the existing Y-axis label values and positions", () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart(
      [
        { time: start, close: 10 },
        { time: start + 60_000, close: 12 },
        { time: start + 120_000, close: 9 },
        { time: start + 180_000, close: 15 },
        { time: start + 240_000, close: 11 }
      ],
      { start, end: start + 240_000 }
    );

    const scale = getChartModel(chart).getVisibleScale();
    expect(
      roundedLabels(
        calculateYAxisLabels({
          yMin: scale.getYMin(),
          yMax: scale.getYMax(),
          canvasHeight: Number.parseFloat(
            getChartContext(chart, "y-label").canvas.style.height
          ),
          fontSize: chart.getOptions().theme.yAxis.fontSize,
          labelSpacing: 30
        })
      )
    ).toEqual([
      { value: 8, position: 360.864198 },
      { value: 9, position: 315.185185 },
      { value: 10, position: 269.506173 },
      { value: 11, position: 223.82716 },
      { value: 12, position: 178.148148 },
      { value: 13, position: 132.469136 },
      { value: 14, position: 86.790123 },
      { value: 15, position: 41.111111 }
    ]);
  });

  it("keeps the existing price-label decimal-place thresholds", () => {
    const start = Date.UTC(2024, 0, 1, 9);

    const largeRangeChart = createChart(
      [
        { time: start, close: 10 },
        { time: start + 60_000, close: 1_000 }
      ],
      { start, end: start + 60_000 }
    );
    expect(getCrosshairPriceLabel(largeRangeChart, start, 10)).toBe("10");

    const mediumRangeChart = createChart(
      [
        { time: start, close: 10 },
        { time: start + 60_000, close: 15 }
      ],
      { start, end: start + 60_000 }
    );
    expect(getCrosshairPriceLabel(mediumRangeChart, start, 10)).toBe("10");

    const tinyRangeChart = createChart(
      [
        { time: start, close: 1.00001 },
        { time: start + 60_000, close: 1.00002 }
      ],
      { start, end: start + 60_000 }
    );
    expect(getCrosshairPriceLabel(tinyRangeChart, start, 1.00001)).toBe(
      "1.00001"
    );
  });

  it("keeps micro-price ticks stable through eight decimal places", () => {
    const labels = calculateYAxisLabels({
      yMin: 0.00000001,
      yMax: 0.00000005,
      canvasHeight: 400,
      fontSize: 12,
      labelSpacing: 30
    });
    expect(labels.at(-1)?.value).toBe(0.00000005);

    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart(
      [
        { time: start, close: 0.00000001 },
        { time: start + 60_000, close: 0.00000002 }
      ],
      { start, end: start + 60_000 }
    );
    const renderer = getChartRenderer(chart) as unknown as {
      calculateYAxisLabels(spacing: number): AxisLabel[];
      estimatePriceLabelDecimalPlaces(spacing: number): number;
    };
    const scale = getChartModel(chart).getVisibleScale();
    expect(scale.getYMin()).toBe(8e-9);
    expect(renderer.calculateYAxisLabels(30)).toHaveLength(7);
    expect(renderer.estimatePriceLabelDecimalPlaces(30)).toBe(8);
    expect(getCrosshairPriceLabel(chart, start, 0.00000001)).toBe(
      "0.00000001"
    );
  });
});

describe("current scale coordinate mapping", () => {
  it("round-trips time and price through pixel coordinates", () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart(
      [
        { time: start, close: 10 },
        { time: start + 60_000, close: 12 },
        { time: start + 120_000, close: 9 },
        { time: start + 180_000, close: 15 },
        { time: start + 240_000, close: 11 }
      ],
      { start, end: start + 240_000 }
    );
    const visibleScale = getChartModel(chart).getVisibleScale();
    const canvas = getChartContext(chart, "main").canvas;

    const pixel = visibleScale.mapToPixel(start + 60_000, 12, canvas);
    expect({
      x: Number(pixel.x.toFixed(6)),
      y: Number(pixel.y.toFixed(6))
    }).toEqual({ x: 216, y: 178.148148 });

    const point = visibleScale.pixelToPoint(pixel.x, pixel.y, canvas);
    expect(point.time).toBeCloseTo(start + 60_000, 6);
    expect(point.price).toBeCloseTo(12, 10);
  });
});

describe("current default formatter output", () => {
  it("formats dates, prices, tooltips, and volumes for en-US in UTC", () => {
    const formatter = new DefaultFormatter();
    const timestamp = Date.UTC(2024, 0, 2, 3, 4, 5);
    formatter.setLocale("en-US");

    expect(formatter.getLocale()).toBe("en-US");
    expect(formatter.formatYear(timestamp)).toBe("2024");
    expect(formatter.formatMonth(timestamp)).toBe("Jan");
    expect(formatter.formatDay(timestamp)).toBe("2");
    expect(formatter.formatHour(timestamp)).toBe("3:04 AM");
    expect(formatter.formatTooltipDate(timestamp)).toBe("Jan 2, 2024, 3:04 AM");
    expect(formatter.formatPrice(1_234_567.89)).toBe("1,234,567.89");
    expect(formatter.formatTooltipPrice(12.34567, 3)).toBe("12.346");
    expect(formatter.formatVolume(1_234_567, 10)).toBe("1.2M");
    expect(formatter.formatVolume(10.25, 1_000)).toBe("10.25");
  });
});

describe("current X-axis tick rendering", () => {
  it("draws intraday hour ticks anchored to real bars", () => {
    const start = Date.UTC(2024, 0, 1, 23);
    const chart = createChart(
      [
        { time: start, close: 10 },
        { time: start + 60 * 60_000, close: 11 },
        { time: start + 2 * 60 * 60_000, close: 12 }
      ],
      { start, end: start + 2 * 60 * 60_000 },
      { stepSize: 60 * 60_000 }
    );

    expect(getFillTextLabels(chart)).toEqual(["2", "11:00 PM", "1:00 AM"]);
    expect(
      getChartRenderer(chart)
        .getLastXGridCoords()
        .map((x) => Math.round(x))
    ).toEqual([360, 120, 600]);
  });

  it("draws long-range ticks prioritized by year, then month, then day", () => {
    const start = Date.UTC(2023, 11, 31);
    const chart = createChart(
      [
        { time: start, close: 10 },
        { time: Date.UTC(2024, 0, 1), close: 11 },
        { time: Date.UTC(2024, 1, 1), close: 12 },
        { time: Date.UTC(2024, 1, 2), close: 13 }
      ],
      { start, end: Date.UTC(2025, 6, 1) },
      { stepSize: 24 * 60 * 60_000 }
    );

    expect(getFillTextLabels(chart)).toEqual(["2024", "Feb", "31", "2"]);
    expect(
      getChartRenderer(chart)
        .getLastXGridCoords()
        .map((x) => Math.round(x))
    ).toEqual([270, 450, 90, 630]);
  });
});
