import { describe, expect, it, vi } from "vitest";
import type { ResolvedChartOptions } from "../src/chart/chart-options";
import type { ChartData } from "../src/chart/types";
import { CandlestickController } from "../src/controllers/candle-controller";
import type { ChartControllerDrawingContext } from "../src/controllers/controller";

function createController(visibleData: readonly ChartData[]) {
  const canvas = document.createElement("canvas");
  const canvasContext = canvas.getContext("2d")!;
  const drawingContext: ChartControllerDrawingContext = {
    canvasContext,
    logicalSize: { width: 100, height: 100 },
    visibleData,
    visibleStartIndex: 0,
    timeRange: { start: 0, end: 1 },
    pixelsPerBar: 10,
    projectIndex: (index) => index * 10,
    projectPrice: (price) => price,
  };
  const options = {
    theme: {
      candle: {
        upColor: "green",
        downColor: "red",
      },
    },
  } as ResolvedChartOptions;

  return {
    canvasContext,
    controller: new CandlestickController(
      { getDrawingContext: () => drawingContext },
      options
    ),
  };
}

function pathsPassedTo(
  method: CanvasRenderingContext2D["fill"] | CanvasRenderingContext2D["stroke"]
): Path2D[] {
  return vi.mocked(method).mock.calls.map(([path]) => path as Path2D);
}

describe("CandlestickController", () => {
  it("fills candle bodies and only strokes wick paths", () => {
    const { canvasContext, controller } = createController([
      { time: 0, open: 10, high: 14, low: 8, close: 12 },
      { time: 1, open: 12, high: 13, low: 7, close: 9 },
    ]);

    controller.draw();

    const bodyPaths = pathsPassedTo(canvasContext.fill);
    const wickPaths = pathsPassedTo(canvasContext.stroke);
    expect(bodyPaths).toHaveLength(2);
    expect(wickPaths).toHaveLength(2);
    for (const bodyPath of bodyPaths) {
      expect(wickPaths).not.toContain(bodyPath);
      expect(vi.mocked(bodyPath.rect)).toHaveBeenCalled();
      expect(vi.mocked(bodyPath.moveTo)).not.toHaveBeenCalled();
    }
    for (const wickPath of wickPaths) {
      expect(vi.mocked(wickPath.moveTo)).toHaveBeenCalled();
      expect(vi.mocked(wickPath.rect)).not.toHaveBeenCalled();
    }
  });

  it("renders a doji with a one-pixel filled body", () => {
    const { canvasContext, controller } = createController([
      { time: 0, open: 10, high: 12, low: 8, close: 10 },
    ]);

    controller.draw();

    const bodyPath = pathsPassedTo(canvasContext.fill).find(
      (path) => vi.mocked(path.rect).mock.calls.length > 0
    );
    expect(bodyPath).toBeDefined();
    expect(vi.mocked(bodyPath!.rect)).toHaveBeenCalledWith(0.5, 9.5, 9, 1);
    expect(pathsPassedTo(canvasContext.stroke)).not.toContain(bodyPath);
  });
});
