import { afterEach, describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData, TimeRange } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { PriceScale } from "../src/scales/price-scale";
import { TimeScale } from "../src/scales/time-scale";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

function createChart(
  data: ChartData[],
  timeRange: TimeRange | "auto",
  overrides: Partial<ConstructorParameters<typeof FinancialChart>[2]> = {}
) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, timeRange, {
    type: "line",
    controllers: [LineController],
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US",
    ...overrides
  });

  chart.draw(data);
  charts.push(chart);
  return chart;
}

describe("index-based time scales", () => {
  it("maps irregular timestamps to contiguous chart slots", () => {
    const day = 24 * 60 * 60_000;
    const friday = Date.UTC(2024, 0, 5);
    const monday = Date.UTC(2024, 0, 8);
    const tuesday = Date.UTC(2024, 0, 9);
    const chart = createChart(
      [
        { time: friday, close: 10 },
        { time: monday, close: 12 },
        { time: tuesday, close: 11 }
      ],
      { start: friday, end: tuesday },
      { stepSize: day }
    );
    const canvas = chart.getContext("main").canvas;
    const timeScale = chart.getTimeScale();

    expect(timeScale.project(friday, { canvas })).toBeCloseTo(120);
    expect(timeScale.project(monday, { canvas })).toBeCloseTo(360);
    expect(timeScale.project(tuesday, { canvas })).toBeCloseTo(600);
  });

  it("keeps a zoomed streaming range pinned to the right edge", () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const data = Array.from({ length: 60 }, (_, index) => ({
      time: start + index * 60_000,
      close: index
    }));
    const chart = createChart(data, "auto");
    const indexedChart = chart as unknown as {
      visibleIndexRange: { from: number; to: number };
      indexBounds: { from: number; to: number };
      zoomVisibleIndexRangeAtPixel(pixel: number, zoomFactor: number): void;
    };

    indexedChart.zoomVisibleIndexRangeAtPixel(chart.getDrawingSize().width, 2);
    const span =
      indexedChart.visibleIndexRange.to - indexedChart.visibleIndexRange.from;

    expect(indexedChart.visibleIndexRange.to).toBeCloseTo(
      indexedChart.indexBounds.to
    );

    chart.drawNextPoint({
      time: start + 60 * 60_000,
      close: 60
    });

    expect(
      indexedChart.visibleIndexRange.to - indexedChart.visibleIndexRange.from
    ).toBeCloseTo(span);
    expect(indexedChart.visibleIndexRange.to).toBeCloseTo(
      indexedChart.indexBounds.to
    );
  });

  it("matches chart scale projection for ordinal time and price", () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const end = start + 4 * 60_000;
    const chart = createChart(
      [
        { time: start, close: 10 },
        { time: start + 60_000, close: 12 },
        { time: start + 2 * 60_000, close: 9 },
        { time: start + 3 * 60_000, close: 15 },
        { time: start + 4 * 60_000, close: 11 }
      ],
      { start, end }
    );
    const visibleScale = chart.getVisibleScale();
    const canvas = chart.getContext("main").canvas;

    const timeScale = new TimeScale(
      {
        from: 0,
        to: 5
      },
      {
        times: chart.getData().map((point) => point.time),
        barAlignment: "center"
      }
    );
    const priceScale = new PriceScale({
      min: visibleScale.getYMin(),
      max: visibleScale.getYMax()
    });

    const options = { canvas };
    const points = [
      { time: start + 60_000, price: 12 },
      { time: start + 3 * 60_000, price: 15 }
    ];

    for (const point of points) {
      const projectedPoint = visibleScale.mapToPixel(
        point.time,
        point.price,
        canvas
      );

      expect(timeScale.project(point.time, options)).toBeCloseTo(
        projectedPoint.x
      );
      expect(priceScale.project(point.price, options)).toBeCloseTo(
        projectedPoint.y
      );
      expect(timeScale.unproject(projectedPoint.x, options)).toBeCloseTo(
        point.time
      );
      expect(priceScale.unproject(projectedPoint.y, options)).toBeCloseTo(
        point.price
      );
    }
  });

  it("round-trips projected ordinal time and price values", () => {
    const canvas = { width: 720, height: 360 };
    const options = {
      canvas,
      devicePixelRatio: 1
    };
    const times = [1_700_000_000_000, 1_700_001_200_000, 1_700_003_600_000];
    const timeScale = new TimeScale(
      {
        from: 0,
        to: 3
      },
      {
        times,
        barAlignment: "center"
      }
    );
    const priceScale = new PriceScale({ min: 87.25, max: 105.75 });
    const time = 1_700_001_200_000;
    const price = 96.5;

    expect(
      timeScale.unproject(timeScale.project(time, options), options)
    ).toBeCloseTo(time);
    expect(
      priceScale.unproject(priceScale.project(price, options), options)
    ).toBeCloseTo(price);
  });

  it("supports edge alignment for bar bodies", () => {
    const canvas = { width: 300, height: 120 };
    const times = [100, 500, 2_000];
    const timeScale = new TimeScale(
      {
        from: 0,
        to: 3
      },
      {
        times,
        barAlignment: "edge"
      }
    );

    expect(timeScale.project(100, { canvas })).toBeCloseTo(0);
    expect(timeScale.project(500, { canvas })).toBeCloseTo(100);
    expect(timeScale.project(2_000, { canvas })).toBeCloseTo(200);
    expect(
      timeScale.project(100, { canvas, barAlignment: "center" })
    ).toBeCloseTo(50);
    expect(timeScale.unproject(149, { canvas })).toBe(500);
  });
});
