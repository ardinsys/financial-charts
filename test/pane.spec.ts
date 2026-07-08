import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/financial-chart";
import { LineController } from "../src/controllers/line-controller";
import { TestIndicator } from "../src/indicators/paneled/test-indicator";
import { Pane } from "../src/panes/pane";

FinancialChart.registerController(LineController);

const charts: FinancialChart[] = [];

class CrosshairProbeIndicator extends TestIndicator {
  public readonly crosshairCalls: Array<{ time: number; relativeY: number }> =
    [];

  public getCrosshairValue(time: number, relativeY: number): string {
    this.crosshairCalls.push({ time, relativeY });
    return "Pane value";
  }
}

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

  it("mounts paneled indicators as panes and routes crosshair by pane", () => {
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
    const indicator = new CrosshairProbeIndicator();

    chart.draw([
      { time: start, close: 10 },
      { time: start + 60_000, close: 12 }
    ]);
    chart.addIndicator(indicator);
    charts.push(chart);

    const [, indicatorPane] = chart.getPanes();
    const indicatorContainer = indicator.getContainer();

    expect(chart.getPaneledIndicators()).toEqual([indicator]);
    expect(chart.getPanes()).toHaveLength(2);
    expect(indicatorPane.getRegion()).toEqual({
      x: 0,
      y: 277.5,
      width: 720,
      height: 92.5
    });
    expect(indicatorPane.getYAxisRegion()).toEqual({
      x: 720,
      y: 277.5,
      width: 80,
      height: 92.5
    });
    expect(indicatorPane.getTimeScale()).toBe(chart.getTimeScale());
    expect(indicatorContainer.style.top).toBe("277.5px");
    expect(indicatorContainer.style.height).toBe("92.5px");

    const pointerChart = chart as unknown as {
      drawCrosshair(): void;
      isTouchCapable: boolean;
      pointerMove(event: { x: number; y: number }): void;
    };

    pointerChart.isTouchCapable = false;
    pointerChart.pointerMove({ x: 360, y: 300 });
    pointerChart.drawCrosshair();

    expect(indicator.crosshairCalls).toHaveLength(1);
    expect(indicator.crosshairCalls[0].time).toBe(start + 60_000);
    expect(indicator.crosshairCalls[0].relativeY).toBeCloseTo(22.5);
  });
});
