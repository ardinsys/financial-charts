import { afterEach, describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import {
  DrawingManager,
  type DrawingFactory,
  HorizontalLine,
  TrendLine,
  type DrawingPoint,
  type DrawingRenderContext
} from "../src/drawings";
import type { ChartPointerEvent } from "../src/plugin/chart-plugin";

FinancialChart.registerController(LineController);

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

function createData(): ChartData[] {
  const start = Date.UTC(2024, 0, 1, 9);

  return [
    { time: start, close: 10 },
    { time: start + 60_000, close: 12 },
    { time: start + 120_000, close: 14 },
    { time: start + 180_000, close: 16 }
  ];
}

function createChart() {
  const data = createData();
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(
    container,
    {
      start: data[0].time,
      end: data.at(-1)!.time + 60_000
    },
    {
      type: "line",
      stepSize: 60_000,
      maxZoom: 10,
      volume: false,
      locale: "en-US"
    }
  );
  chart.draw(data);
  charts.push(chart);

  return { chart, data };
}

function pointerEvent(
  chart: FinancialChart,
  dataPoint: ChartData,
  type: ChartPointerEvent["type"],
  point: DrawingPoint
): ChartPointerEvent {
  return {
    type,
    ...point,
    time: dataPoint.time,
    pane: chart.getMainPane(),
    dataPoint
  };
}

function createManager(chart: FinancialChart, factory: DrawingFactory) {
  const manager = new DrawingManager({
    drawingFactory: factory,
    hitTestTolerance: 8
  });
  chart.addPlugin(manager);
  return manager;
}

function createDrawing(
  chart: FinancialChart,
  data: ChartData[],
  manager: DrawingManager,
  start: DrawingPoint,
  end: DrawingPoint
) {
  manager.onPointer(pointerEvent(chart, data[0], "down", start));
  manager.onPointer(pointerEvent(chart, data[1], "move", end));
  manager.onPointer(pointerEvent(chart, data[1], "up", end));

  return manager.getDrawings()[0];
}

function drawingContext(chart: FinancialChart): DrawingRenderContext {
  return {
    pane: chart.getMainPane(),
    canvas: chart.getContext("drawings").canvas
  };
}

describe("drawing tools", () => {
  it("creates, hit-tests, moves, draws, and deletes a trendline", () => {
    const { chart, data } = createChart();
    const manager = createManager(
      chart,
      ({ anchors, paneId }) => new TrendLine({ anchors, paneId })
    );

    const drawing = createDrawing(
      chart,
      data,
      manager,
      { x: 120, y: 180 },
      { x: 360, y: 220 }
    ) as TrendLine;
    const anchorsBeforeMove = drawing.getAnchors();

    expect(manager.hitTest({ x: 240, y: 200 }, chart.getMainPane())).toBe(
      drawing
    );
    expect(drawing.hitTest({ x: 240, y: 260 }, drawingHitContext(chart))).toBe(
      false
    );

    manager.onPointer(pointerEvent(chart, data[1], "down", { x: 240, y: 200 }));
    manager.onPointer(pointerEvent(chart, data[2], "move", { x: 300, y: 230 }));
    manager.onPointer(pointerEvent(chart, data[2], "up", { x: 300, y: 230 }));

    const anchorsAfterMove = drawing.getAnchors();
    expect(anchorsAfterMove[0].index).toBeGreaterThan(
      anchorsBeforeMove[0].index
    );
    expect(anchorsAfterMove[0].price).toBeLessThan(anchorsBeforeMove[0].price);

    chart.requestRedraw("drawings", true);
    expect(chart.getContext("drawings").stroke).toHaveBeenCalled();

    manager.deleteSelected();

    expect(manager.getDrawings()).toEqual([]);
  });

  it("creates, hit-tests, moves, draws, and deletes a horizontal line", () => {
    const { chart, data } = createChart();
    const manager = createManager(
      chart,
      ({ anchors, paneId }) => new HorizontalLine({ anchors, paneId })
    );

    const drawing = createDrawing(
      chart,
      data,
      manager,
      { x: 120, y: 180 },
      { x: 360, y: 240 }
    ) as HorizontalLine;
    const anchorsBeforeMove = drawing.getAnchors();

    expect(manager.hitTest({ x: 20, y: 240 }, chart.getMainPane())).toBe(
      drawing
    );
    expect(drawing.hitTest({ x: 20, y: 270 }, drawingHitContext(chart))).toBe(
      false
    );

    manager.onPointer(pointerEvent(chart, data[1], "down", { x: 400, y: 240 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 400, y: 200 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 400, y: 200 }));

    const anchorsAfterMove = drawing.getAnchors();
    expect(anchorsAfterMove.at(-1)!.price).toBeGreaterThan(
      anchorsBeforeMove.at(-1)!.price
    );

    chart.requestRedraw("drawings", true);
    expect(chart.getContext("drawings").stroke).toHaveBeenCalled();

    manager.deleteSelected();

    expect(manager.getDrawings()).toEqual([]);
  });
});

function drawingHitContext(chart: FinancialChart) {
  return {
    ...drawingContext(chart),
    tolerance: 8
  };
}
