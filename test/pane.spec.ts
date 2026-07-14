import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import { LineController } from "../src/controllers/line-controller";
import { TestIndicator } from "../src/indicators/paneled/test-indicator";
import { Pane } from "../src/panes/pane";

const charts: FinancialChart[] = [];

class CrosshairProbeIndicator extends TestIndicator {
  public readonly crosshairCalls: Array<{ time: number; relativeY: number }> =
    [];

  public getCrosshairValue(time: number, relativeY: number): string {
    this.crosshairCalls.push({ time, relativeY });
    return "Pane value";
  }
}

function createPaneChart() {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);
  const start = Date.UTC(2024, 0, 1, 9);
  const chart = new FinancialChart(
    container,
    {
      timeRange: { start, end: start + 60_000 },
      type: "line",
      controllers: [LineController],
      stepSize: 60_000,
      maxZoom: 10,
      volume: false,
      locale: "en-US"
    }
  );

  chart.setData([
    { time: start, close: 10 },
    { time: start + 60_000, close: 12 }
  ]);
  charts.push(chart);

  return { chart, container, start };
}

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

describe("Pane", () => {
  it("owns immutable region snapshots without copying them on reads", () => {
    const pane = new Pane(3);
    const region = { x: 1, y: 2, width: 300, height: 200 };

    pane.setRegion(region);
    region.height = 400;

    expect(pane.getRegion()).toEqual({ x: 1, y: 2, width: 300, height: 200 });
    expect(pane.getRegion()).toBe(pane.getRegion());
    expect(Object.isFrozen(pane.getRegion())).toBe(true);
  });

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
    expect(pane.getDrawables()).toBe(pane.getDrawables());
    expect(Object.isFrozen(pane.getDrawables())).toBe(true);
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
      {
        timeRange: { start, end: start + 60_000 },
        type: "line",
        controllers: [LineController],
        stepSize: 60_000,
        maxZoom: 10,
        volume: false,
        locale: "en-US"
      }
    );

    chart.setData([
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
      min: chart.getVisibleScale().getYMin(),
      max: chart.getVisibleScale().getYMax()
    });
  });

  it("mounts paneled indicators as panes and routes crosshair by pane", () => {
    const { chart, start } = createPaneChart();
    const indicator = new CrosshairProbeIndicator();

    chart.addIndicator(indicator);

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

    chart.getContext("crosshair").canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 360,
        clientY: 300,
        bubbles: true
      })
    );
    chart.requestRedraw("crosshair", true);

    expect(indicator.crosshairCalls).toHaveLength(1);
    expect(indicator.crosshairCalls[0].time).toBe(start + 60_000);
    expect(indicator.crosshairCalls[0].relativeY).toBeCloseTo(22.5);
  });

  it("exposes and applies pane heights through the public API", () => {
    const { chart } = createPaneChart();
    const indicator = new TestIndicator();

    chart.addIndicator(indicator);

    const [mainPane, indicatorPane] = chart.getPanes();
    expect(chart.getPaneHeights()).toEqual({
      [mainPane.getId()]: 277.5,
      [indicatorPane.getId()]: 92.5
    });

    chart.setPaneHeights({
      [mainPane.getId()]: 220,
      [indicatorPane.getId()]: 150
    });

    expect(chart.getPaneHeights()).toEqual({
      [mainPane.getId()]: 220,
      [indicatorPane.getId()]: 150
    });
    expect(mainPane.getRegion().height).toBe(220);
    expect(indicatorPane.getRegion()).toEqual({
      x: 0,
      y: 220,
      width: 720,
      height: 150
    });
    expect(indicator.getContainer().style.top).toBe("220px");
    expect(indicator.getContainer().style.height).toBe("150px");
  });

  it("clamps explicit pane heights to the pane minimums", () => {
    const { chart } = createPaneChart();
    const indicator = new TestIndicator();

    chart.addIndicator(indicator);

    const [mainPane, indicatorPane] = chart.getPanes();
    chart.setPaneHeights({
      [mainPane.getId()]: 10,
      [indicatorPane.getId()]: 360
    });

    expect(chart.getPaneHeights()).toEqual({
      [mainPane.getId()]: 80,
      [indicatorPane.getId()]: 290
    });
    expect(mainPane.getRegion().height).toBe(80);
    expect(indicatorPane.getRegion()).toEqual({
      x: 0,
      y: 80,
      width: 720,
      height: 290
    });
  });

  it("resizes adjacent panes by dragging the adapter-rendered divider", () => {
    const { chart, container } = createPaneChart();
    const indicator = new TestIndicator();

    chart.addIndicator(indicator);

    const [mainPane, indicatorPane] = chart.getPanes();
    const divider = container.querySelector(
      '[data-id="pane-divider"]'
    ) as HTMLElement;

    expect(divider).toBeTruthy();
    expect(divider.dataset.beforePaneId).toBe(String(mainPane.getId()));
    expect(divider.dataset.afterPaneId).toBe(String(indicatorPane.getId()));

    divider.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientY: 277.5
      })
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientY: 307.5
      })
    );

    expect(chart.getPaneHeights()).toEqual({
      [mainPane.getId()]: 307.5,
      [indicatorPane.getId()]: 62.5
    });

    window.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientY: 477.5
      })
    );
    window.dispatchEvent(
      new MouseEvent("pointerup", {
        bubbles: true,
        clientY: 477.5
      })
    );

    expect(chart.getPaneHeights()).toEqual({
      [mainPane.getId()]: 320,
      [indicatorPane.getId()]: 50
    });
    expect(indicator.getContainer().style.top).toBe("320px");
    expect(indicator.getContainer().style.height).toBe("50px");
  });
});
