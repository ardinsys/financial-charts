import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import {
  Drawing,
  type DrawingAnchor,
  type DrawingHitTestContext,
  DrawingManager,
  type DrawingPoint,
  type DrawingRenderContext
} from "../src/drawings";
import type { ChartPointerEvent } from "../src/plugin/chart-plugin";

FinancialChart.registerController(LineController);

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

function createManager(chart: FinancialChart) {
  const manager = new DrawingManager({
    drawingFactory: ({ anchors, paneId }) =>
      new StubDrawing({ anchors, paneId }),
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

describe("DrawingManager", () => {
  it("creates, selects, moves, and deletes a stub drawing", () => {
    const { chart, data } = createChart();
    const manager = createManager(chart);
    const created = vi.fn();
    const changed = vi.fn();
    const deleted = vi.fn();
    const selected = vi.fn();
    chart.on("drawing-create", created);
    chart.on("drawing-change", changed);
    chart.on("drawing-delete", deleted);
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
    expect(selected).toHaveBeenCalledWith({ drawing });
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

    manager.deleteSelected();

    expect(manager.getDrawings()).toEqual([]);
    expect(manager.getSelectedDrawing()).toBeUndefined();
    expect(deleted).toHaveBeenCalledWith({ drawing });
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
