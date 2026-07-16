import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import {
  Drawing,
  type DrawingHitTestContext,
  type DrawingPoint,
  type DrawingRenderContext
} from "../src/drawings";
import type { ChartContext, ChartPlugin } from "../src/plugin/chart-plugin";
import { DrawingAxisBoundsPlugin } from "../src/plugins/drawing-axis-bounds-plugin";
import { getInternalMainPane } from "./chart-test-harness";

const charts: FinancialChart[] = [];

class BoundsDrawing extends Drawing {
  readonly type = "bounds";

  draw(_context: CanvasRenderingContext2D, _drawing: DrawingRenderContext) {}

  hitTest(_point: DrawingPoint, _context: DrawingHitTestContext): boolean {
    return false;
  }
}

class SiblingAnnotationPlugin implements ChartPlugin {
  readonly key = "sibling-annotation";
  private context?: ChartContext;

  attach(context: ChartContext): void {
    this.context = context;
  }

  show() {
    this.context?.setPriceAxisAnnotations([
      { id: "sibling", value: 12, text: "sibling" }
    ]);
  }
}

afterEach(() => {
  while (charts.length > 0) charts.pop()?.dispose();
  document.body.innerHTML = "";
});

function createChart() {
  const start = Date.UTC(2024, 0, 1, 9);
  const data: ChartData[] = [
    { time: start, close: 10 },
    { time: start + 60_000, close: 12 },
    { time: start + 120_000, close: 14 }
  ];
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, {
    timeRange: { start, end: data.at(-1)!.time + 60_000 },
    type: "line",
    controllers: [LineController],
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US"
  });
  chart.setData(data);
  chart.requestRedraw(
    ["grid", "axes", "series", "indicators", "annotations"],
    true
  );
  charts.push(chart);
  return { chart, container };
}

function getAnnotationContext(container: HTMLElement) {
  const canvas = [...container.querySelectorAll("canvas")].find(
    (candidate) => candidate.style.zIndex === "70"
  );
  return canvas!.getContext("2d")!;
}

describe("DrawingAxisBoundsPlugin", () => {
  it("contributes Y-axis bounds without accessing the shared Y-axis canvas", () => {
    const { chart, container } = createChart();
    const bounds = new DrawingAxisBoundsPlugin({
      formatYValue: ({ anchor }) => anchor.price.toFixed(0)
    });
    const sibling = new SiblingAnnotationPlugin();
    let eventContext: ChartContext | undefined;
    const eventSource: ChartPlugin = {
      key: "drawing-event-source",
      attach: (context) => {
        eventContext = context;
      }
    };
    chart.addPlugin(bounds);
    chart.addPlugin(sibling);
    chart.addPlugin(eventSource);
    sibling.show();

    const drawing = new BoundsDrawing({
      anchors: [
        { index: 0, price: 10 },
        { index: 2, price: 14 }
      ]
    });
    const getContext = vi.spyOn(chart, "getContext");
    const getData = vi.spyOn(chart, "getData");
    const getOptions = vi.spyOn(chart, "getOptions");

    eventContext?.emit("drawing-select", { drawing });

    expect(getContext).not.toHaveBeenCalled();
    expect(getData).not.toHaveBeenCalled();
    expect(getOptions).not.toHaveBeenCalled();
    getContext.mockRestore();

    const context = getAnnotationContext(container);
    const mainPane = getInternalMainPane(chart);
    vi.mocked(context.fillText).mockClear();
    vi.mocked(context.fillRect).mockClear();
    chart.requestRedraw("annotations", true);

    const text = vi.mocked(context.fillText).mock.calls.map(([value]) => value);
    expect(text).toEqual(expect.arrayContaining(["S 10", "E 14", "sibling"]));
    expect(context.fillRect).toHaveBeenCalledWith(
      mainPane.getYAxisRegion().x + 5,
      expect.any(Number),
      mainPane.getYAxisRegion().width - 10,
      expect.any(Number)
    );

    vi.mocked(context.fillText).mockClear();
    eventContext?.emit("drawing-select", {});
    chart.requestRedraw("annotations", true);

    expect(
      vi.mocked(context.fillText).mock.calls.map(([value]) => value)
    ).toEqual(["sibling"]);
  });
});
