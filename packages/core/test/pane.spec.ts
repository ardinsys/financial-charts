import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import { LineController } from "../src/controllers/line-controller";
import { TestIndicator } from "./fixtures/test-indicator";
import { Pane } from "../src/panes/pane";
import {
  getChartModel,
  getChartContext,
  getInternalMainPane,
  getInternalPanes,
  getPaneLayout,
  requestChartRedraw,
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

function getPaneHeights(chart: FinancialChart): Record<number, number> {
  return Object.fromEntries(
    chart.getPanes().map(({ id, height }) => [id, height])
  );
}

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
  const chart = new FinancialChart(container, {
    timeRange: { start, end: start + 60_000 },
    type: "line",
    controllers: [LineController],
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US",
  });

  chart.setData([
    { time: start, close: 10 },
    { time: start + 60_000, close: 12 },
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
  it("owns stable region snapshots without copying them on reads", () => {
    const pane = new Pane(3);
    const region = { x: 1, y: 2, width: 300, height: 200 };

    pane.setRegion(region);
    region.height = 400;

    expect(pane.getRegion()).toEqual({ x: 1, y: 2, width: 300, height: 200 });
    expect(pane.getRegion()).toBe(pane.getRegion());

    const first = pane.getRegion();
    pane.setRegion({ x: 1, y: 2, width: 300, height: 200 });
    expect(pane.getRegion()).toBe(first);

    pane.setRegion({ x: 2, y: 3, width: 400, height: 250 });

    expect(pane.getRegion()).not.toBe(first);
    expect(first).toEqual({ x: 1, y: 2, width: 300, height: 200 });
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
      height: 200,
    });
    expect(pane.getPriceScale().getRange()).toEqual({ min: 10, max: 20 });
    expect(pane.getDrawables()).toEqual([second, first]);
    expect(pane.getDrawables()).toBe(pane.getDrawables());
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
    const chart = new FinancialChart(container, {
      timeRange: { start, end: start + 60_000 },
      type: "line",
      controllers: [LineController],
      stepSize: 60_000,
      maxZoom: 10,
      volume: false,
      locale: "en-US",
    });

    chart.setData([
      { time: start, close: 10 },
      { time: start + 60_000, close: 12 },
    ]);
    charts.push(chart);

    const [mainPaneSnapshot] = chart.getPanes();
    const mainPane = getInternalMainPane(chart);

    expect(chart.getPanes()).toHaveLength(1);
    expect(mainPaneSnapshot).toEqual({
      id: 0,
      height: 370,
      kind: "main",
    });
    expect(chart.getMainPane()).toBe(mainPaneSnapshot);
    expect(mainPane.getRegion()).toEqual({
      x: 0,
      y: 0,
      width: 720,
      height: 370,
    });
    expect(mainPane.getYAxisRegion()).toEqual({
      x: 720,
      y: 0,
      width: 80,
      height: 370,
    });
    expect(mainPane.getTimeScale()).toBe(getChartModel(chart).getTimeScale());
    expect(mainPane.getPriceScale().getRange()).toEqual({
      min: getChartModel(chart).getVisibleScale().getYMin(),
      max: getChartModel(chart).getVisibleScale().getYMax(),
    });
  });

  it("mounts paneled indicators as panes and routes crosshair by pane", () => {
    const { chart, start } = createPaneChart();
    const indicator = new CrosshairProbeIndicator();

    chart.addIndicator(indicator);

    const [, indicatorPaneSnapshot] = chart.getPanes();
    const [, indicatorPane] = getInternalPanes(chart);
    const indicatorContainer = indicator.getContainer();

    expect(chart.getIndicators()).toEqual([indicator]);
    expect(chart.getPanes()).toHaveLength(2);
    expect(indicatorPaneSnapshot).toEqual({
      id: indicatorPane.getId(),
      height: 92.5,
      kind: "indicator",
      indicatorInstanceId: indicator.getInstanceId(),
    });
    expect(indicatorPane.getRegion()).toEqual({
      x: 0,
      y: 277.5,
      width: 720,
      height: 92.5,
    });
    expect(indicatorPane.getYAxisRegion()).toEqual({
      x: 720,
      y: 277.5,
      width: 80,
      height: 92.5,
    });
    expect(indicatorPane.getTimeScale()).toBe(
      getChartModel(chart).getTimeScale()
    );
    expect(indicatorContainer.style.top).toBe("277.5px");
    expect(indicatorContainer.style.height).toBe("92.5px");

    getChartContext(chart, "crosshair").canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 360,
        clientY: 300,
        bubbles: true,
      })
    );
    requestChartRedraw(chart, "crosshair", true);

    expect(indicator.crosshairCalls).toHaveLength(1);
    expect(indicator.crosshairCalls[0].time).toBe(start + 60_000);
    expect(indicator.crosshairCalls[0].relativeY).toBeCloseTo(22.5);
  });

  it("exposes and applies pane heights through the public API", () => {
    const { chart } = createPaneChart();
    const indicator = new TestIndicator();

    chart.addIndicator(indicator);
    const onPaneHeightsChange = vi.fn();
    chart.on("pane-heights-change", onPaneHeightsChange);

    const initialPanes = chart.getPanes();
    const [mainPane, indicatorPane] = initialPanes;
    const [internalMainPane, internalIndicatorPane] = getInternalPanes(chart);
    expect(getPaneHeights(chart)).toEqual({
      [mainPane.id]: 277.5,
      [indicatorPane.id]: 92.5,
    });

    chart.setPaneHeights({
      [mainPane.id]: 220,
      [indicatorPane.id]: 150,
    });

    expect(getPaneHeights(chart)).toEqual({
      [mainPane.id]: 220,
      [indicatorPane.id]: 150,
    });
    expect(chart.getPanes()).not.toBe(initialPanes);
    expect(chart.getPanes().map((pane) => pane.height)).toEqual([220, 150]);
    expect(internalMainPane.getRegion().height).toBe(220);
    expect(internalIndicatorPane.getRegion()).toEqual({
      x: 0,
      y: 220,
      width: 720,
      height: 150,
    });
    expect(indicator.getContainer().style.top).toBe("220px");
    expect(indicator.getContainer().style.height).toBe("150px");
    expect(onPaneHeightsChange).toHaveBeenCalledOnce();
    expect(onPaneHeightsChange).toHaveBeenCalledWith(chart.toJSON().panes);
  });

  it("clamps explicit pane heights to the pane minimums", () => {
    const { chart } = createPaneChart();
    const indicator = new TestIndicator();

    chart.addIndicator(indicator);

    const [mainPane, indicatorPane] = chart.getPanes();
    const [internalMainPane, internalIndicatorPane] = getInternalPanes(chart);
    chart.setPaneHeights({
      [mainPane.id]: 10,
      [indicatorPane.id]: 360,
    });

    expect(getPaneHeights(chart)).toEqual({
      [mainPane.id]: 80,
      [indicatorPane.id]: 290,
    });
    expect(internalMainPane.getRegion().height).toBe(80);
    expect(internalIndicatorPane.getRegion()).toEqual({
      x: 0,
      y: 80,
      width: 720,
      height: 290,
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
    expect(divider.dataset.beforePaneId).toBe(String(mainPane.id));
    expect(divider.dataset.afterPaneId).toBe(String(indicatorPane.id));
    const layout = getPaneLayout(chart) as unknown as {
      paneHeightsCustomized: boolean;
    };
    expect(layout.paneHeightsCustomized).toBe(false);

    divider.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientY: 277.5,
      })
    );
    expect(layout.paneHeightsCustomized).toBe(false);
    window.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientY: 277.5,
      })
    );
    expect(layout.paneHeightsCustomized).toBe(false);
    window.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientY: 307.5,
      })
    );
    expect(layout.paneHeightsCustomized).toBe(true);

    expect(getPaneHeights(chart)).toEqual({
      [mainPane.id]: 307.5,
      [indicatorPane.id]: 62.5,
    });

    window.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientY: 477.5,
      })
    );
    window.dispatchEvent(
      new MouseEvent("pointerup", {
        bubbles: true,
        clientY: 477.5,
      })
    );

    expect(getPaneHeights(chart)).toEqual({
      [mainPane.id]: 320,
      [indicatorPane.id]: 50,
    });
    expect(indicator.getContainer().style.top).toBe("320px");
    expect(indicator.getContainer().style.height).toBe("50px");
  });
});
