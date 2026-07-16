import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { TestIndicator } from "../src/indicators/paneled/test-indicator";
import { DrawingSelectionPlugin } from "../src/plugins/drawing-selection-plugin";
import type { BarAlignment } from "../src/scales/time-scale";
import {
  Drawing,
  type DrawingHitTestContext,
  type DrawingFactory,
  DrawingManager,
  type DrawingPoint,
  type DrawingRenderContext,
  TrendLine
} from "../src/drawings";
import type {
  ChartPlugin,
  ChartPointerEvent
} from "../src/plugin/chart-plugin";
import {
  getChartModel,
  getChartContext,
  getInternalMainPane,
  getInternalPanes,
  requestChartRedraw
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

class StubDrawing extends Drawing {
  readonly type = "stub";

  draw = vi.fn(
    (ctx: CanvasRenderingContext2D, context: DrawingRenderContext) => {
      const anchors = this.projectForTest(context);
      if (anchors.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(anchors[0].x, anchors[0].y);
      for (const anchor of anchors.slice(1)) {
        ctx.lineTo(anchor.x, anchor.y);
      }
      ctx.stroke();
    }
  );

  hitTest(point: DrawingPoint, context: DrawingHitTestContext): boolean {
    const anchors = this.projectForTest(context);
    return anchors.some(
      (anchor) => distance(anchor, point) <= context.tolerance
    );
  }

  projectForTest(context: DrawingRenderContext) {
    return this.projectAnchors(context);
  }
}

class EdgeAnchorLineController extends LineController {
  static ID = "edge-line";

  getTimeAnchorAlignment(): BarAlignment {
    return "edge";
  }
}

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

function createChart({
  controllers = [LineController],
  type = "line"
}: {
  controllers?: (typeof LineController)[];
  type?: string;
} = {}) {
  const data = createData();
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, {
    timeRange: {
      start: data[0].time,
      end: data.at(-1)!.time + 60_000
    },
    type,
    controllers,
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US"
  });
  chart.setData(data);
  charts.push(chart);

  return { chart, container, data };
}

function pointerEvent(
  chart: FinancialChart,
  dataPoint: ChartData,
  type: ChartPointerEvent["type"],
  point: DrawingPoint,
  options: Partial<ChartPointerEvent> = {}
): ChartPointerEvent {
  return {
    type,
    ...point,
    time: dataPoint.time,
    pane: getInternalMainPane(chart),
    dataPoint,
    ...options
  };
}

const stubDrawingFactory: DrawingFactory = ({ anchors, paneId }) =>
  new StubDrawing({ anchors, paneId });

function createManager(chart: FinancialChart) {
  const manager = new DrawingManager({
    drawingFactory: stubDrawingFactory,
    hitTestTolerance: 10
  });
  chart.addPlugin(manager);
  return manager;
}

function distance(a: DrawingPoint, b: DrawingPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function drawingContext(chart: FinancialChart): DrawingRenderContext {
  return {
    pane: getInternalMainPane(chart),
    canvas: getChartContext(chart, "drawings").canvas
  };
}

function keyDown(
  host: HTMLElement,
  key: string,
  options: KeyboardEventInit = {}
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  });
  return host.dispatchEvent(event);
}

function dragChart(
  chart: FinancialChart,
  start: DrawingPoint,
  end: DrawingPoint,
  options: { button?: number } = {}
) {
  const canvas = getChartContext(chart, "crosshair").canvas;
  canvas.dispatchEvent(
    new PointerEvent("pointerdown", {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      button: options.button ?? 0,
      bubbles: true
    })
  );
  canvas.dispatchEvent(
    new MouseEvent("mousemove", {
      clientX: end.x,
      clientY: end.y,
      bubbles: true
    })
  );
  canvas.dispatchEvent(
    new PointerEvent("pointerup", {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      button: options.button ?? 0,
      bubbles: true
    })
  );
}

function waitForRedraw() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("DrawingManager", () => {
  it("supports state before attachment and preserves it across reattachment", () => {
    const manager = new DrawingManager();
    const drawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 1, price: 12 }
      ],
      id: "preloaded-trend"
    });

    manager.addDrawing(drawing);
    expect(manager.getDrawings()).toEqual([drawing]);
    expect(manager.getSelectedDrawing()).toBe(drawing);

    const { chart } = createChart();
    chart.addPlugin(manager);
    chart.removePlugin(manager);

    expect(manager.getDrawings()).toEqual([drawing]);
    expect(manager.getSelectedDrawing()).toBe(drawing);

    chart.addPlugin(manager);
    expect(manager.deleteSelected()).toBe(true);
    expect(manager.getDrawings()).toEqual([]);
  });

  it("validates drawing identity and restores state atomically", () => {
    const manager = new DrawingManager();
    const drawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 1, price: 12 }
      ],
      id: "trend"
    });
    manager.addDrawing(drawing);

    expect(() =>
      manager.addDrawing(
        new TrendLine({
          anchors: [{ index: 2, price: 14 }],
          id: drawing.id
        })
      )
    ).toThrow('Drawing id "trend" is already registered.');

    const json = drawing.toJSON();
    expect(() => manager.fromJSON({ drawings: [json, json] })).toThrow(
      'Drawing id "trend" is duplicated.'
    );
    expect(() =>
      manager.fromJSON({
        drawings: [json],
        selectedDrawingId: "missing"
      })
    ).toThrow('Selected drawing "missing" was not found.');

    expect(manager.getDrawings()).toEqual([drawing]);
    expect(manager.getSelectedDrawing()).toBe(drawing);
    expect(manager.getDrawingById("trend")).toBe(drawing);
    expect(manager.clearDrawings()).toEqual([drawing]);
    expect(manager.getDrawings()).toEqual([]);
  });

  it("synchronizes retained selection with selection plugins", () => {
    const { chart } = createChart();
    const manager = new DrawingManager();
    const drawing = manager.addDrawing(
      new TrendLine({
        anchors: [{ index: 0, price: 10 }],
        id: "selected"
      })
    );
    const onSelect = vi.fn();

    chart.addPlugin(manager);
    const selection = new DrawingSelectionPlugin(onSelect);
    chart.addPlugin(selection);
    expect(onSelect).toHaveBeenLastCalledWith(
      drawing,
      expect.objectContaining({ id: drawing.id })
    );

    chart.removePlugin(manager);
    expect(onSelect).toHaveBeenLastCalledWith(undefined, {
      drawing: undefined
    });
    expect(manager.getSelectedDrawing()).toBe(drawing);

    chart.addPlugin(manager);
    expect(onSelect).toHaveBeenLastCalledWith(
      drawing,
      expect.objectContaining({ id: drawing.id })
    );

    manager.clearDrawings();
    expect(onSelect).toHaveBeenLastCalledWith(undefined, {
      drawing: undefined
    });
  });

  it("validates persisted drawing primitives", () => {
    expect(
      () => new StubDrawing({ anchors: [{ index: NaN, price: 10 }] })
    ).toThrow("Drawing anchors must contain finite index and price values.");
    expect(() => new StubDrawing({ anchors: [], id: " " })).toThrow(
      "Drawing id must be a non-empty string."
    );
    expect(() => new StubDrawing({ anchors: [], paneId: -1 })).toThrow(
      "Drawing paneId must be a non-negative integer."
    );
  });

  it("owns anchor inputs and borrows stable anchor snapshots", () => {
    const input = [
      { index: 1, price: 10 },
      { index: 2, price: 20 }
    ];
    const drawing = new StubDrawing({ anchors: input });
    const first = drawing.getAnchors();

    input[0].price = 100;

    expect(first).toEqual([
      { index: 1, price: 10 },
      { index: 2, price: 20 }
    ]);
    expect(drawing.getAnchors()).toBe(first);

    const json = drawing.toJSON();
    expect(json.anchors).toEqual(first);
    expect(json.anchors).not.toBe(first);
    expect(json.anchors[0]).not.toBe(first[0]);

    drawing.moveBy({ index: 1, price: 5 });

    expect(drawing.getAnchors()).not.toBe(first);
    expect(first).toEqual([
      { index: 1, price: 10 },
      { index: 2, price: 20 }
    ]);
    expect(drawing.getAnchors()).toEqual([
      { index: 2, price: 15 },
      { index: 3, price: 25 }
    ]);
  });

  it("creates, selects, moves, and deletes a stub drawing", () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);
    const created = vi.fn();
    const changed = vi.fn();
    const deleted = vi.fn();
    const finished = vi.fn();
    const selected = vi.fn();
    const plugin: ChartPlugin = {
      key: "drawing-finished-probe",
      attach: vi.fn(),
      onDrawingFinished: vi.fn()
    };
    chart.addPlugin(plugin);
    chart.on("drawing-create", created);
    chart.on("drawing-change", changed);
    chart.on("drawing-delete", deleted);
    chart.on("drawing-finished", finished);
    chart.on("drawing-select", selected);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 120, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 280, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 280, y: 220 }));

    const drawing = manager.getDrawings()[0] as StubDrawing;
    const anchorsBeforeMove = drawing.getAnchors();

    expect(manager.getDrawings()).toHaveLength(1);
    expect(manager.getSelectedDrawing()).toBe(drawing);
    expect(drawing.isSelected()).toBe(true);
    expect(created).toHaveBeenCalledWith({ drawing });
    expect(changed).toHaveBeenCalledWith({ drawing });
    expect(selected).toHaveBeenCalledWith({
      drawing,
      id: drawing.id,
      type: drawing.type,
      paneId: drawing.getPaneId(),
      anchors: drawing.getAnchors(),
      json: drawing.toJSON()
    });
    expect(finished).toHaveBeenCalledWith({
      drawing,
      operation: "create",
      id: drawing.id,
      type: drawing.type,
      paneId: drawing.getPaneId(),
      anchors: drawing.getAnchors(),
      json: drawing.toJSON()
    });
    expect(plugin.onDrawingFinished).toHaveBeenCalledWith(
      expect.objectContaining({ drawing, operation: "create" })
    );
    expect(anchorsBeforeMove[0]).not.toEqual(anchorsBeforeMove[1]);

    const [firstProjectedAnchor] = drawing.projectForTest(
      drawingContext(chart)
    );

    manager.onPointer(
      pointerEvent(chart, data[0], "down", firstProjectedAnchor)
    );
    manager.onPointer(
      pointerEvent(chart, data[1], "move", {
        x: firstProjectedAnchor.x + 90,
        y: firstProjectedAnchor.y + 30
      })
    );
    manager.onPointer(
      pointerEvent(chart, data[1], "up", {
        x: firstProjectedAnchor.x + 90,
        y: firstProjectedAnchor.y + 30
      })
    );

    const anchorsAfterMove = drawing.getAnchors();
    expect(anchorsAfterMove[0].index).toBeGreaterThan(
      anchorsBeforeMove[0].index
    );
    expect(anchorsAfterMove[0].price).toBeLessThan(anchorsBeforeMove[0].price);
    expect(finished).toHaveBeenLastCalledWith(
      expect.objectContaining({ drawing, operation: "move" })
    );

    manager.deleteSelected();

    expect(manager.getDrawings()).toEqual([]);
    expect(manager.getSelectedDrawing()).toBeUndefined();
    expect(deleted).toHaveBeenCalledWith({ drawing });
    expect(selected).toHaveBeenLastCalledWith({ drawing: undefined });
  });

  it("supports keyboard undo, redo, and delete", () => {
    const { chart, container, data } = createChart();
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 120, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 280, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 280, y: 220 }));

    const drawing = manager.getDrawings()[0]!;
    expect(container.tabIndex).toBe(0);
    expect(container.style.outline).toBe("none");
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    expect(keyDown(container, "z", { ctrlKey: true })).toBe(false);
    expect(manager.getDrawings()).toEqual([]);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);

    expect(keyDown(container, "y", { ctrlKey: true })).toBe(false);
    expect(manager.getDrawings()).toEqual([drawing]);

    manager.selectDrawing(drawing);
    expect(keyDown(container, "Delete")).toBe(false);
    expect(manager.getDrawings()).toEqual([]);

    expect(keyDown(container, "z", { ctrlKey: true })).toBe(false);
    expect(manager.getDrawings()).toEqual([drawing]);

    expect(keyDown(container, "z", { ctrlKey: true, shiftKey: true })).toBe(
      false
    );
    expect(manager.getDrawings()).toEqual([]);
  });

  it("clears the active drawing factory after finishing a created drawing", () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 120, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 280, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 280, y: 220 }));

    expect(manager.getDrawings()).toHaveLength(1);

    manager.onPointer(pointerEvent(chart, data[2], "down", { x: 520, y: 140 }));
    manager.onPointer(pointerEvent(chart, data[3], "move", { x: 640, y: 240 }));
    manager.onPointer(pointerEvent(chart, data[3], "up", { x: 640, y: 240 }));

    expect(manager.getDrawings()).toHaveLength(1);

    manager.setDrawingFactory(stubDrawingFactory);
    manager.onPointer(pointerEvent(chart, data[2], "down", { x: 520, y: 140 }));
    manager.onPointer(pointerEvent(chart, data[3], "move", { x: 640, y: 240 }));
    manager.onPointer(pointerEvent(chart, data[3], "up", { x: 640, y: 240 }));

    expect(manager.getDrawings()).toHaveLength(2);
  });

  it("snaps drawing anchors to whole bar indexes", () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 127, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 293, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 293, y: 220 }));

    const drawing = manager.getDrawings()[0] as StubDrawing;

    expect(
      drawing.getAnchors().every((anchor) => Number.isInteger(anchor.index))
    ).toBe(true);

    manager.selectDrawing(drawing);

    const [firstProjectedAnchor] = drawing.projectForTest(
      drawingContext(chart)
    );

    manager.onPointer(
      pointerEvent(chart, data[0], "down", firstProjectedAnchor)
    );
    manager.onPointer(
      pointerEvent(chart, data[1], "move", {
        x: firstProjectedAnchor.x + 47,
        y: firstProjectedAnchor.y + 30
      })
    );
    manager.onPointer(
      pointerEvent(chart, data[1], "up", {
        x: firstProjectedAnchor.x + 47,
        y: firstProjectedAnchor.y + 30
      })
    );

    expect(
      drawing.getAnchors().every((anchor) => Number.isInteger(anchor.index))
    ).toBe(true);
  });

  it("projects drawing anchors with the controller time-anchor alignment", () => {
    const { chart, data } = createChart({
      controllers: [EdgeAnchorLineController],
      type: "edge-line"
    });
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 127, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 293, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 293, y: 220 }));

    const drawing = manager.getDrawings()[0] as StubDrawing;
    const [anchor] = drawing.getAnchors();
    const [projectedAnchor] = drawing.projectForTest(drawingContext(chart));
    const canvas = getChartContext(chart, "drawings").canvas;

    expect(getInternalMainPane(chart).getTimeAnchorAlignment()).toBe("edge");
    expect(projectedAnchor.x).toBeCloseTo(
      getChartModel(chart).getTimeScale().projectIndex(anchor.index, {
        canvas,
        barAlignment: "edge"
      })
    );
    expect(projectedAnchor.x).not.toBeCloseTo(
      getChartModel(chart).getTimeScale().projectIndex(anchor.index, {
        canvas,
        barAlignment: "center"
      })
    );
  });

  it("moves selected drawing anchors independently", () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 120, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 280, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 280, y: 220 }));

    const drawing = manager.getDrawings()[0] as StubDrawing;
    manager.selectDrawing(drawing);

    const anchorsBeforeMove = drawing.getAnchors();
    const [firstProjectedAnchor] = drawing.projectForTest(
      drawingContext(chart)
    );

    manager.onPointer(
      pointerEvent(chart, data[0], "down", firstProjectedAnchor)
    );
    manager.onPointer(
      pointerEvent(chart, data[1], "move", {
        x: firstProjectedAnchor.x + 90,
        y: firstProjectedAnchor.y + 30
      })
    );
    manager.onPointer(
      pointerEvent(chart, data[1], "up", {
        x: firstProjectedAnchor.x + 90,
        y: firstProjectedAnchor.y + 30
      })
    );

    const anchorsAfterMove = drawing.getAnchors();
    expect(anchorsAfterMove[0].index).toBeGreaterThan(
      anchorsBeforeMove[0].index
    );
    expect(anchorsAfterMove[0].price).toBeLessThan(anchorsBeforeMove[0].price);
    expect(anchorsAfterMove[1]).toEqual(anchorsBeforeMove[1]);
  });

  it("prevents chart panning while a drawing tool is active", () => {
    const { chart } = createChart();
    createManager(chart);
    const internals = chart as unknown as {
      setVisibleIndexRange(range: { from: number; to: number }): void;
    };
    internals.setVisibleIndexRange({ from: 1, to: 3 });
    const before = chart.getVisibleLogicalRange();
    const clicked = vi.fn();
    chart.on("click", clicked);

    dragChart(chart, { x: 240, y: 120 }, { x: 360, y: 160 });

    expect(chart.getVisibleLogicalRange()).toEqual(before);
    expect(clicked).not.toHaveBeenCalled();
  });

  it("redraws managed drawings while the chart pans", async () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 120, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 280, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 280, y: 220 }));

    const drawing = manager.getDrawings()[0] as StubDrawing;
    const internals = chart as unknown as {
      setVisibleIndexRange(range: { from: number; to: number }): void;
    };
    internals.setVisibleIndexRange({ from: 1, to: 3 });
    const [beforePan] = drawing.projectForTest(drawingContext(chart));

    drawing.draw.mockClear();

    dragChart(chart, { x: 700, y: 320 }, { x: 620, y: 320 });
    await waitForRedraw();

    const [afterPan] = drawing.projectForTest(drawingContext(chart));

    expect(drawing.draw).toHaveBeenCalled();
    expect(afterPan.x).not.toBeCloseTo(beforePan.x);
  });

  it("ignores right-click drawing gestures", () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);
    const clicked = vi.fn();
    chart.on("click", clicked);

    manager.onPointer(
      pointerEvent(chart, data[0], "down", { x: 120, y: 120 }, { button: 2 })
    );
    manager.onPointer(
      pointerEvent(chart, data[1], "move", { x: 280, y: 220 }, { button: 2 })
    );
    manager.onPointer(
      pointerEvent(chart, data[1], "up", { x: 280, y: 220 }, { button: 2 })
    );

    expect(manager.getDrawings()).toEqual([]);

    dragChart(chart, { x: 240, y: 120 }, { x: 360, y: 160 }, { button: 2 });

    expect(manager.getDrawings()).toEqual([]);
    expect(clicked).not.toHaveBeenCalled();
  });

  it("keeps data-space anchors stable while projection changes across pan", () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 120, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 280, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 280, y: 220 }));

    const drawing = manager.getDrawings()[0] as StubDrawing;
    const anchors = drawing.getAnchors();
    const [beforePan] = drawing.projectForTest(drawingContext(chart));

    (
      chart as unknown as {
        setVisibleIndexRange(range: { from: number; to: number }): void;
      }
    ).setVisibleIndexRange({ from: 1, to: 4 });

    const [afterPan] = drawing.projectForTest(drawingContext(chart));

    expect(drawing.getAnchors()).toEqual(anchors);
    expect(afterPan.x).toBeLessThan(beforePan.x);
  });

  it("draws managed drawings on the drawings layer", () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 120, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 280, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 280, y: 220 }));

    const drawing = manager.getDrawings()[0] as StubDrawing;
    requestChartRedraw(chart, "drawings", true);

    expect(drawing.draw).toHaveBeenCalled();
  });

  it("projects and clips drawings in their target pane", () => {
    const { chart } = createChart();
    const indicator = new TestIndicator();
    chart.addIndicator(indicator);
    const pane = getInternalPanes(chart)[1];
    const manager = createManager(chart);
    const priceRange = pane.getPriceScale().getRange();
    const drawing = new StubDrawing({
      anchors: [{ index: 1, price: (priceRange.min + priceRange.max) / 2 }],
      paneId: pane.getId()
    });
    manager.addDrawing(drawing);

    const context = getChartContext(chart, "drawings");
    const [point] = drawing.projectForTest({ pane, canvas: context.canvas });
    const region = pane.getRegion();

    expect(Number.parseFloat(context.canvas.style.height)).toBe(
      region.y + region.height
    );
    expect(point.y).toBeGreaterThanOrEqual(region.y);
    expect(point.y).toBeLessThanOrEqual(region.y + region.height);

    vi.mocked(context.rect).mockClear();
    requestChartRedraw(chart, "drawings", true);
    expect(context.rect).toHaveBeenCalledWith(
      region.x,
      region.y,
      region.width,
      region.height
    );
  });
});
