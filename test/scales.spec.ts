import { afterEach, describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/financial-chart";
import type { ChartData, TimeRange } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { PriceScale } from "../src/scales/price-scale";
import { TimeScale } from "../src/scales/time-scale";

FinancialChart.registerController(LineController);

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

function createChart(data: ChartData[], timeRange: TimeRange) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, timeRange, {
    type: "line",
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US",
  });

  chart.draw(data);
  charts.push(chart);
  return chart;
}

describe("time-based scales", () => {
  it("matches the legacy coordinate projection for time and price", () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const end = start + 4 * 60_000;
    const chart = createChart(
      [
        { time: start, close: 10 },
        { time: start + 60_000, close: 12 },
        { time: start + 2 * 60_000, close: 9 },
        { time: start + 3 * 60_000, close: 15 },
        { time: start + 4 * 60_000, close: 11 },
      ],
      { start, end }
    );
    const visibleScale = chart.getVisibleExtent();
    const canvas = chart.getContext("main").canvas;
    const zoomLevel = 2;
    const panOffset = 30;

    const timeScale = new TimeScale({
      start: visibleScale.getXMin(),
      end: visibleScale.getXMax(),
    });
    const priceScale = new PriceScale({
      min: visibleScale.getYMin(),
      max: visibleScale.getYMax(),
    });

    const options = { canvas, zoomLevel, panOffset };
    const points = [
      { time: start + 60_000, price: 12 },
      { time: start + 3 * 60_000, price: 15 },
    ];

    for (const point of points) {
      const projectedPoint = visibleScale.mapToPixel(
        point.time,
        point.price,
        canvas,
        zoomLevel,
        panOffset
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

  it("round-trips projected time and price values", () => {
    const canvas = { width: 720, height: 360 };
    const options = {
      canvas,
      devicePixelRatio: 1,
      zoomLevel: 1.75,
      panOffset: 24,
    };
    const timeScale = new TimeScale({
      start: 1_700_000_000_000,
      end: 1_700_003_600_000,
    });
    const priceScale = new PriceScale({ min: 87.25, max: 105.75 });
    const time = 1_700_001_200_000;
    const price = 96.5;

    expect(timeScale.unproject(timeScale.project(time, options), options))
      .toBeCloseTo(time);
    expect(priceScale.unproject(priceScale.project(price, options), options))
      .toBeCloseTo(price);
  });
});
