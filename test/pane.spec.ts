import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/financial-chart";
import { LineController } from "../src/controllers/line-controller";
import { Pane } from "../src/panes/pane";

FinancialChart.registerController(LineController);

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

describe("Pane", () => {
  it("owns layout regions, price scale, and z-ordered drawables", () => {
    const pane = new Pane(3);
    const first = { zIndex: 10, draw: vi.fn() };
    const second = { zIndex: 0, draw: vi.fn() };

    pane.setRegion({ x: 1, y: 2, width: 300, height: 200 });
    pane.setYAxisRegion({ x: 301, y: 2, width: 80, height: 200 });
    pane.setPriceRange(10, 20);
    pane.addDrawable(first);
    pane.addDrawable(second);
    pane.draw();

    expect(pane.getId()).toBe(3);
    expect(pane.getRegion()).toEqual({ x: 1, y: 2, width: 300, height: 200 });
    expect(pane.getYAxisRegion()).toEqual({
      x: 301,
      y: 2,
      width: 80,
      height: 200
    });
    expect(pane.getPriceScale().getRange()).toEqual({ min: 10, max: 20 });
    expect(pane.getDrawables()).toEqual([second, first]);
    expect(second.draw.mock.invocationCallOrder[0]).toBeLessThan(
      first.draw.mock.invocationCallOrder[0]
    );
  });

  it("makes the financial chart's main surface pane 0", () => {
    const container = document.createElement("div");
    container.style.width = "800px";
    container.style.height = "400px";
    document.body.appendChild(container);
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = new FinancialChart(
      container,
      { start, end: start + 60_000 },
      {
        type: "line",
        stepSize: 60_000,
        maxZoom: 10,
        volume: false,
        locale: "en-US"
      }
    );

    chart.draw([
      { time: start, close: 10 },
      { time: start + 60_000, close: 12 }
    ]);
    charts.push(chart);

    const [mainPane] = chart.getPanes();

    expect(chart.getPanes()).toHaveLength(1);
    expect(mainPane.getId()).toBe(0);
    expect(mainPane.getRegion()).toEqual({
      x: 0,
      y: 0,
      width: 720,
      height: 370
    });
    expect(mainPane.getYAxisRegion()).toEqual({
      x: 720,
      y: 0,
      width: 80,
      height: 370
    });
    expect(mainPane.getTimeScale()).toBe(chart.getTimeScale());
    expect(chart.getPriceScale()).toBe(mainPane.getPriceScale());
    expect(mainPane.getPriceScale().getRange()).toEqual({
      min: chart.getVisibleExtent().getYMin(),
      max: chart.getVisibleExtent().getYMax()
    });
  });
});
