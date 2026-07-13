import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import type { BarAlignment } from "../src/scales/time-scale";
import {
  Drawing,
  type DrawingHitTestContext,
  type DrawingFactory,
  DrawingManager,
  type DrawingPoint,
  type DrawingRenderContext
} from "../src/drawings";
import type {
  ChartPlugin,
  ChartPointerEvent
} from "../src/plugin/chart-plugin";

const charts: FinancialChart[] = [];

class StubDrawing extends Drawing {
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

  const chart = new FinancialChart(
    container,
    {
      start: data[0].time,
      end: data.at(-1)!.time + 60_000
    },
    {
      type,
      controllers,
      stepSize: 60_000,
      maxZoom: 10,
      volume: false,
      locale: "en-US"
    }
  );
  chart.setData(data);
  charts.push(chart);

  return { chart, data };
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
    pane: chart.getMainPane(),
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
    pane: chart.getMainPane(),
    canvas: chart.getContext("drawings").canvas
  };
}

function keyDown(
  chart: FinancialChart,
  key: string,
  options: KeyboardEventInit = {}
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  });
  return chart.getOutsideContainer().dispatchEvent(event);
}

function dragChart(
  chart: FinancialChart,
  start: DrawingPoint,
  end: DrawingPoint,
  options: { button?: number } = {}
) {
  const pointerChart = chart as unknown as {
    onMouseDown(event: PointerEvent): void;
    onMouseMove(event: MouseEvent): void;
    onMouseUp(event: PointerEvent): void;
  };

  pointerChart.onMouseDown(
    new PointerEvent("pointerdown", {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      button: options.button ?? 0
    })
  );
  pointerChart.onMouseMove(
    new MouseEvent("mousemove", {
      clientX: end.x,
      clientY: end.y
    })
  );
  pointerChart.onMouseUp(
    new PointerEvent("pointerup", {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      button: options.button ?? 0
    })
  );
}

function waitForRedraw() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("DrawingManager", () => {
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
    const { chart, data } = createChart();
    const manager = createManager(chart);

    manager.onPointer(pointerEvent(chart, data[0], "down", { x: 120, y: 120 }));
    manager.onPointer(pointerEvent(chart, data[1], "move", { x: 280, y: 220 }));
    manager.onPointer(pointerEvent(chart, data[1], "up", { x: 280, y: 220 }));

    const drawing = manager.getDrawings()[0]!;
    expect(chart.getOutsideContainer().tabIndex).toBe(0);
    expect(chart.getOutsideContainer().style.outline).toBe("none");
    expect(manager.canUndo()).toBe(true);
    expect(manager.canRedo()).toBe(false);

    expect(keyDown(chart, "z", { ctrlKey: true })).toBe(false);
    expect(manager.getDrawings()).toEqual([]);
    expect(manager.canUndo()).toBe(false);
    expect(manager.canRedo()).toBe(true);

    expect(keyDown(chart, "y", { ctrlKey: true })).toBe(false);
    expect(manager.getDrawings()).toEqual([drawing]);

    manager.selectDrawing(drawing);
    expect(keyDown(chart, "Delete")).toBe(false);
    expect(manager.getDrawings()).toEqual([]);

    expect(keyDown(chart, "z", { ctrlKey: true })).toBe(false);
    expect(manager.getDrawings()).toEqual([drawing]);

    expect(keyDown(chart, "z", { ctrlKey: true, shiftKey: true })).toBe(false);
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
    const canvas = chart.getContext("drawings").canvas;

    expect(chart.getTimeAnchorAlignment()).toBe("edge");
    expect(projectedAnchor.x).toBeCloseTo(
      chart.getTimeScale().projectIndex(anchor.index, {
        canvas,
        barAlignment: "edge"
      })
    );
    expect(projectedAnchor.x).not.toBeCloseTo(
      chart.getTimeScale().projectIndex(anchor.index, {
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
    chart.requestRedraw("drawings", true);

    expect(drawing.draw).toHaveBeenCalled();
  });
});
