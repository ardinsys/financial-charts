import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import {
  type DrawingAnchor,
  DrawingManager,
  type DrawingFactory,
  type DrawingManagerJSON,
  HorizontalLine,
  RectangleDrawing,
  TextDrawing,
  TrendLine,
  type DrawingPoint,
  type DrawingRenderContext,
} from "../src/drawings";
import type { ChartPointerEvent } from "../src/plugin/chart-plugin";
import {
  getChartContext,
  getChartRenderer,
  getInternalMainPane,
  requestChartRedraw,
} from "./chart-test-harness";

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
    { time: start + 180_000, close: 16 },
  ];
}

function createChart() {
  const data = createData();
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, {
    timeRange: {
      start: data[0].time,
      end: data.at(-1)!.time + 60_000,
    },
    type: "line",
    controllers: [LineController],
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US",
  });
  chart.setData(data);
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
    pane: getInternalMainPane(chart),
    dataPoint,
  };
}

function createManager(chart: FinancialChart, factory: DrawingFactory) {
  const manager = new DrawingManager({
    drawingFactory: factory,
    hitTestTolerance: 8,
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
  const theme = chart.getOptions().theme;
  return {
    pane: getInternalMainPane(chart),
    canvas: getChartContext(chart, "drawings").canvas,
    handleTheme: {
      centerColor: theme.yAxis.color,
      fillColor: theme.backgroundColor,
      strokeColor: theme.crosshair.color,
    },
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

    expect(
      manager.hitTest({ x: 240, y: 200 }, getInternalMainPane(chart))
    ).toBe(drawing);
    expect(drawing.hitTest({ x: 240, y: 260 }, drawingHitContext(chart))).toBe(
      false
    );

    manager.onPointer(pointerEvent(chart, data[1], "down", { x: 240, y: 200 }));
    manager.onPointer(pointerEvent(chart, data[2], "move", { x: 460, y: 230 }));
    manager.onPointer(pointerEvent(chart, data[2], "up", { x: 460, y: 230 }));

    const anchorsAfterMove = drawing.getAnchors();
    expect(anchorsAfterMove[0].index).toBeGreaterThan(
      anchorsBeforeMove[0].index
    );
    expect(anchorsAfterMove[0].price).toBeLessThan(anchorsBeforeMove[0].price);

    requestChartRedraw(chart, "drawings", true);
    expect(getChartContext(chart, "drawings").stroke).toHaveBeenCalled();

    manager.deleteSelected();

    expect(manager.getDrawings()).toEqual([]);
  });

  it("resolves drawing handles from the active chart theme", () => {
    const { chart } = createChart();
    const manager = createManager(
      chart,
      ({ anchors, paneId }) => new TrendLine({ anchors, paneId })
    );
    manager.addDrawing(
      new TrendLine({
        anchors: [
          { index: 0, price: 10 },
          { index: 2, price: 14 },
        ],
      })
    );
    const context = getChartContext(chart, "drawings");

    requestChartRedraw(chart, "drawings", true);
    expect(context.fillStyle).toBe(chart.getOptions().theme.yAxis.color);
    expect(context.strokeStyle).toBe(chart.getOptions().theme.crosshair.color);

    chart.updateOptions({ theme: "dark" });
    requestChartRedraw(chart, "drawings", true);
    expect(context.fillStyle).toBe(chart.getOptions().theme.yAxis.color);
    expect(context.strokeStyle).toBe(chart.getOptions().theme.crosshair.color);
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

    expect(manager.hitTest({ x: 20, y: 240 }, getInternalMainPane(chart))).toBe(
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

    requestChartRedraw(chart, "drawings", true);
    expect(getChartContext(chart, "drawings").stroke).toHaveBeenCalled();

    manager.deleteSelected();

    expect(manager.getDrawings()).toEqual([]);
  });

  it("creates, hit-tests, moves, draws, and deletes a rectangle", () => {
    const { chart, data } = createChart();
    const manager = createManager(
      chart,
      ({ anchors, paneId }) => new RectangleDrawing({ anchors, paneId })
    );

    const drawing = createDrawing(
      chart,
      data,
      manager,
      { x: 120, y: 160 },
      { x: 360, y: 240 }
    ) as RectangleDrawing;
    const anchorsBeforeMove = drawing.getAnchors();

    expect(
      manager.hitTest({ x: 240, y: 160 }, getInternalMainPane(chart))
    ).toBe(drawing);
    expect(drawing.hitTest({ x: 240, y: 200 }, drawingHitContext(chart))).toBe(
      true
    );

    manager.onPointer(pointerEvent(chart, data[1], "down", { x: 240, y: 160 }));
    manager.onPointer(pointerEvent(chart, data[2], "move", { x: 460, y: 190 }));
    manager.onPointer(pointerEvent(chart, data[2], "up", { x: 460, y: 190 }));

    const anchorsAfterMove = drawing.getAnchors();
    expect(anchorsAfterMove[0].index).toBeGreaterThan(
      anchorsBeforeMove[0].index
    );
    expect(anchorsAfterMove[0].price).toBeLessThan(anchorsBeforeMove[0].price);

    requestChartRedraw(chart, "drawings", true);
    expect(getChartContext(chart, "drawings").rect).toHaveBeenCalled();

    manager.deleteSelected();

    expect(manager.getDrawings()).toEqual([]);
  });

  it("creates, edits, hit-tests, moves, draws, and deletes text", () => {
    const { chart, data } = createChart();
    const manager = createManager(
      chart,
      ({ anchors, paneId }) =>
        new TextDrawing({ anchors, paneId, text: "Earnings" })
    );

    const drawing = createDrawing(
      chart,
      data,
      manager,
      { x: 160, y: 160 },
      { x: 300, y: 220 }
    ) as TextDrawing;
    const anchorsBeforeMove = drawing.getAnchors();

    const textAnchorPoint = projectAnchor(chart, drawing.getAnchors()[0]);

    expect(
      manager.hitTest(
        { x: textAnchorPoint.x + 8, y: textAnchorPoint.y + 8 },
        getInternalMainPane(chart)
      )
    ).toBe(drawing);
    expect(drawing.hitTest({ x: 320, y: 260 }, drawingHitContext(chart))).toBe(
      false
    );

    const changed = vi.fn();
    chart.on("drawing-change", changed);
    const requestRedraw = vi.spyOn(getChartRenderer(chart), "requestRedraw");
    requestRedraw.mockClear();

    drawing.setText("Guidance");

    expect(drawing.getText()).toBe("Guidance");
    expect(changed).toHaveBeenCalledWith({ drawing });
    expect(requestRedraw).toHaveBeenCalledWith("drawings", undefined);

    changed.mockClear();
    drawing.setText("Guidance");
    expect(changed).not.toHaveBeenCalled();

    manager.onPointer(
      pointerEvent(chart, data[1], "down", {
        x: textAnchorPoint.x + 8,
        y: textAnchorPoint.y + 8,
      })
    );
    manager.onPointer(
      pointerEvent(chart, data[2], "move", {
        x: textAnchorPoint.x + 220,
        y: textAnchorPoint.y + 48,
      })
    );
    manager.onPointer(
      pointerEvent(chart, data[2], "up", {
        x: textAnchorPoint.x + 220,
        y: textAnchorPoint.y + 48,
      })
    );

    const anchorsAfterMove = drawing.getAnchors();
    expect(anchorsAfterMove[0].index).toBeGreaterThan(
      anchorsBeforeMove[0].index
    );
    expect(anchorsAfterMove[0].price).toBeLessThan(anchorsBeforeMove[0].price);

    requestChartRedraw(chart, "drawings", true);
    expect(getChartContext(chart, "drawings").fillText).toHaveBeenCalledWith(
      "Guidance",
      expect.any(Number),
      expect.any(Number)
    );

    manager.deleteSelected();

    expect(manager.getDrawings()).toEqual([]);
  });

  it("round-trips drawings through JSON and preserves data-space anchors", () => {
    const { chart } = createChart();
    const manager = createManager(chart, ({ anchors, paneId }) => {
      return new TrendLine({ anchors, paneId });
    });
    const paneId = getInternalMainPane(chart).getId();
    const originalAnchors: DrawingAnchor[] = [
      { index: 0.25, price: 10.5 },
      { index: 2.5, price: 14.25 },
    ];
    const selected = new TextDrawing({
      anchors: [{ index: 1.5, price: 12.75 }],
      id: "text-1",
      paneId,
      text: "Reloaded",
    });
    manager.addDrawing(
      new TrendLine({
        anchors: originalAnchors,
        id: "trend-1",
        paneId,
        color: "#abcdef",
      })
    );
    manager.addDrawing(
      new HorizontalLine({
        anchors: [{ index: 1, price: 11 }],
        id: "horizontal-1",
        paneId,
      })
    );
    manager.addDrawing(
      new RectangleDrawing({
        anchors: [
          { index: 0.5, price: 10.75 },
          { index: 3, price: 13.5 },
        ],
        id: "rectangle-1",
        paneId,
      })
    );
    manager.addDrawing(selected);
    manager.selectDrawing(selected);

    const json = JSON.parse(JSON.stringify(manager)) as DrawingManagerJSON;
    chart.removePlugin(manager);

    const reloadedManager = new DrawingManager();
    chart.addPlugin(reloadedManager);
    const reloadedDrawings = reloadedManager.fromJSON(json);
    const reloadedTrend = reloadedDrawings.find(
      (drawing) => drawing.id === "trend-1"
    ) as TrendLine;
    const reloadedText = reloadedDrawings.find(
      (drawing) => drawing.id === "text-1"
    ) as TextDrawing;
    const beforePan = projectAnchor(chart, reloadedTrend.getAnchors()[0]);

    (
      chart as unknown as {
        setVisibleLogicalRange(range: { from: number; to: number }): void;
      }
    ).setVisibleLogicalRange({ from: 1, to: 4 });

    const afterPan = projectAnchor(chart, reloadedTrend.getAnchors()[0]);

    expect(json.drawings.map((drawing) => drawing.type)).toEqual([
      "trendline",
      "horizontal-line",
      "rectangle",
      "text",
    ]);
    expect(reloadedDrawings).toHaveLength(4);
    expect(reloadedTrend.getAnchors()).toEqual(originalAnchors);
    expect(reloadedText.getText()).toBe("Reloaded");
    expect(reloadedManager.getSelectedDrawing()).toBe(reloadedText);
    expect(reloadedTrend.getAnchors()).toEqual(originalAnchors);
    expect(afterPan.x).toBeLessThan(beforePan.x);
  });
});

function drawingHitContext(chart: FinancialChart) {
  return {
    ...drawingContext(chart),
    tolerance: 8,
  };
}

function projectAnchor(chart: FinancialChart, anchor: DrawingAnchor) {
  const pane = getInternalMainPane(chart);
  const canvas = getChartContext(chart, "drawings").canvas;

  return {
    x: pane.getTimeScale()!.projectIndex(anchor.index, {
      canvas,
      barAlignment: pane.getTimeAnchorAlignment(),
    }),
    y: pane.getPriceScale().project(anchor.price, { canvas }),
  };
}
