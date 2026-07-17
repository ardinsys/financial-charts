import { afterEach, describe, expect, it, vi } from "vitest";
import type { PriceAxisAnnotation } from "../src/annotations/price-axis-annotation";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { TestIndicator } from "./fixtures/test-indicator";
import type { ChartContext, ChartPlugin } from "../src/plugin/chart-plugin";
import {
  getChartContext,
  getChartRenderer,
  getInternalMainPane,
  getInternalPanes,
  requestChartRedraw,
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

class AnnotationProbe implements ChartPlugin {
  readonly key: string;
  private context?: ChartContext;

  constructor(key = "annotation-probe") {
    this.key = key;
  }

  attach(context: ChartContext): void {
    this.context = context;
  }

  set(annotations: readonly PriceAxisAnnotation[]) {
    this.context?.setPriceAxisAnnotations(annotations);
  }

  clear() {
    this.context?.clearPriceAxisAnnotations();
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
    { time: start + 120_000, close: 14 },
  ];
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const chart = new FinancialChart(container, {
    timeRange: { start, end: data.at(-1)!.time },
    type: "line",
    controllers: [LineController],
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US",
    themes: {
      annotations: {
        priceAxisAnnotation: {
          color: "#123456",
          textColor: "#fedcba",
        },
      },
    },
  });
  chart.setData(data);
  requestChartRedraw(
    chart,
    ["grid", "axes", "series", "indicators", "annotations"],
    true
  );
  charts.push(chart);

  return { chart, data };
}

function getAnnotationContext(chart: FinancialChart) {
  const chartContainer = getChartContext(chart, "main").canvas.closest(
    ".financial-charts"
  )!;
  const canvas = [...chartContainer.querySelectorAll("canvas")].find(
    (candidate) => candidate.style.zIndex === "70"
  );
  return canvas!.getContext("2d")!;
}

describe("price axis annotations", () => {
  it("owns submitted annotation values before rendering", () => {
    const { chart } = createChart();
    const probe = new AnnotationProbe();
    chart.addPlugin(probe);
    const context = getAnnotationContext(chart);
    const redraw = vi.spyOn(getChartRenderer(chart), "requestRedraw");
    const renderedFonts: string[] = [];
    const rangeColors: string[] = [];
    vi.mocked(context.fillText).mockImplementation(() => {
      renderedFonts.push(context.font);
    });
    vi.mocked(context.fillRect).mockImplementation(() => {
      rangeColors.push(String(context.fillStyle));
    });
    vi.mocked(context.setLineDash).mockClear();
    const annotation = {
      id: "owned",
      value: 11,
      text: "owned",
      lineDash: [2, 4],
      range: { to: 13, color: "#123456" },
      labelStyle: { font: "Owned Font", radius: 1 },
    };
    const annotations = [annotation];

    probe.set(annotations);
    annotation.text = "mutated";
    annotation.lineDash[0] = 99;
    annotation.range.color = "#654321";
    annotation.labelStyle.font = "Mutated Font";
    annotations.length = 0;
    requestChartRedraw(chart, "annotations", true);

    expect(redraw).toHaveBeenCalledWith("annotations");
    expect(context.fillText).toHaveBeenCalledWith(
      "owned",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
    expect(context.setLineDash).toHaveBeenCalledWith([2, 4]);
    expect(rangeColors).toContain("#123456");
    expect(renderedFonts.some((font) => font.includes("Owned Font"))).toBe(
      true
    );
  });

  it("adds, updates, clears, and detaches a provider-owned collection", () => {
    const { chart } = createChart();
    const probe = new AnnotationProbe();
    const remove = chart.addPlugin(probe);
    const annotationContext = getAnnotationContext(chart);
    const yAxisContext = getChartContext(chart, "y-label");
    vi.mocked(annotationContext.fillText).mockClear();
    vi.mocked(annotationContext.stroke).mockClear();
    vi.mocked(yAxisContext.clearRect).mockClear();

    probe.set([{ id: "order", value: 12, text: "initial" }]);
    requestChartRedraw(chart, "annotations", true);

    expect(annotationContext.fillText).toHaveBeenCalledWith(
      "initial",
      760,
      expect.any(Number),
      72
    );
    expect(annotationContext.stroke).toHaveBeenCalledOnce();
    expect(yAxisContext.clearRect).not.toHaveBeenCalled();

    vi.mocked(annotationContext.fillText).mockClear();
    probe.set([{ id: "order", value: 12, text: "updated" }]);
    requestChartRedraw(chart, "annotations", true);
    expect(annotationContext.fillText).toHaveBeenCalledWith(
      "updated",
      760,
      expect.any(Number),
      72
    );

    vi.mocked(annotationContext.fillText).mockClear();
    vi.mocked(annotationContext.stroke).mockClear();
    probe.clear();
    requestChartRedraw(chart, "annotations", true);
    expect(annotationContext.clearRect).toHaveBeenCalled();
    expect(annotationContext.fillText).not.toHaveBeenCalled();
    expect(annotationContext.stroke).not.toHaveBeenCalled();

    probe.set([{ id: "order", value: 12 }]);
    requestChartRedraw(chart, "annotations", true);
    vi.mocked(annotationContext.fillText).mockClear();
    remove();
    requestChartRedraw(chart, "annotations", true);
    expect(annotationContext.fillText).not.toHaveBeenCalled();
  });

  it("renders providers in order and gives emphasized labels collision priority", () => {
    const { chart } = createChart();
    const first = new AnnotationProbe("first");
    const second = new AnnotationProbe("second");
    chart.addPlugin(first);
    chart.addPlugin(second);
    const context = getAnnotationContext(chart);
    const strokeColors: string[] = [];
    vi.mocked(context.stroke).mockImplementation(() => {
      strokeColors.push(String(context.strokeStyle));
    });
    vi.mocked(context.fillText).mockClear();

    first.set([{ id: "first", value: 12, text: "first", color: "red" }]);
    second.set([
      {
        id: "second",
        value: 12,
        text: "emphasized",
        color: "blue",
        emphasized: true,
      },
    ]);
    requestChartRedraw(chart, "annotations", true);

    expect(strokeColors).toEqual(["red", "blue"]);
    expect(context.fillText).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith(
      "emphasized",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it("projects and clips annotations independently for each pane", () => {
    const { chart } = createChart();
    chart.addIndicator(new TestIndicator());
    requestChartRedraw(chart, ["indicators", "annotations"], true);
    const panes = getInternalPanes(chart);
    const probe = new AnnotationProbe();
    chart.addPlugin(probe);
    const context = getAnnotationContext(chart);
    vi.mocked(context.rect).mockClear();
    vi.mocked(context.fillText).mockClear();

    probe.set([
      { id: "main", value: 12, text: "main" },
      {
        id: "pane",
        paneId: panes[1].getId(),
        value: 12,
        text: "pane",
      },
      { id: "missing", paneId: 999, value: 12, text: "missing" },
    ]);
    requestChartRedraw(chart, "annotations", true);

    expect(context.rect).toHaveBeenCalledWith(
      panes[0].getRegion().x,
      panes[0].getRegion().y,
      panes[0].getRegion().width,
      panes[0].getRegion().height
    );
    expect(context.rect).toHaveBeenCalledWith(
      panes[1].getRegion().x,
      panes[1].getRegion().y,
      panes[1].getRegion().width,
      panes[1].getRegion().height
    );
    expect(
      vi.mocked(context.fillText).mock.calls.map(([text]) => text)
    ).toEqual(["main", "pane"]);
  });

  it("hides off-screen values by default and can clamp them to a pane edge", () => {
    const { chart } = createChart();
    const probe = new AnnotationProbe();
    chart.addPlugin(probe);
    const context = getAnnotationContext(chart);
    vi.mocked(context.fillText).mockClear();

    probe.set([
      { id: "hidden", value: 100, text: "hidden" },
      {
        id: "clamped",
        value: 100,
        text: "clamped",
        offscreen: "clamp",
      },
    ]);
    requestChartRedraw(chart, "annotations", true);

    expect(context.fillText).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith(
      "clamped",
      expect.any(Number),
      getInternalMainPane(chart).getRegion().y + 9,
      expect.any(Number)
    );
  });

  it("controls annotation, line, and label visibility independently", () => {
    const { chart } = createChart();
    const probe = new AnnotationProbe();
    chart.addPlugin(probe);
    const context = getAnnotationContext(chart);
    vi.mocked(context.stroke).mockClear();
    vi.mocked(context.fillText).mockClear();

    probe.set([
      { id: "hidden", value: 12, visible: false },
      { id: "label", value: 11, text: "label", line: false },
      { id: "line", value: 13, text: "line", label: false },
    ]);
    requestChartRedraw(chart, "annotations", true);

    expect(context.stroke).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledWith(
      "label",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it("supports axis-only lines, ranges, styled labels, and overlap opt-out", () => {
    const { chart } = createChart();
    const probe = new AnnotationProbe();
    chart.addPlugin(probe);
    const context = getAnnotationContext(chart);
    const axisRegion = getInternalMainPane(chart).getYAxisRegion();
    vi.mocked(context.rect).mockClear();
    vi.mocked(context.fillRect).mockClear();
    vi.mocked(context.fillText).mockClear();
    vi.mocked(context.quadraticCurveTo).mockClear();

    probe.set([
      {
        id: "start",
        value: 11,
        text: "start",
        line: "axis",
        collision: "allow",
        range: { to: 13, color: "range", inset: 5 },
        labelStyle: {
          borderColor: "border",
          borderWidth: 1,
          edgeInset: 4,
          height: 22,
          inset: 5,
          paddingX: 8,
          radius: 5,
        },
      },
      {
        id: "end",
        value: 11,
        text: "end",
        line: "axis",
        collision: "allow",
      },
    ]);
    requestChartRedraw(chart, "annotations", true);

    expect(context.rect).toHaveBeenCalledWith(
      axisRegion.x,
      axisRegion.y,
      axisRegion.width,
      axisRegion.height
    );
    expect(context.fillRect).toHaveBeenCalledWith(
      axisRegion.x + 5,
      expect.any(Number),
      axisRegion.width - 10,
      expect.any(Number)
    );
    expect(context.quadraticCurveTo).toHaveBeenCalled();
    expect(context.fillText).toHaveBeenCalledTimes(2);
  });

  it("uses updated theme defaults without changing provider models", () => {
    const { chart } = createChart();
    const probe = new AnnotationProbe();
    chart.addPlugin(probe);
    const context = getAnnotationContext(chart);
    const strokeColors: string[] = [];
    vi.mocked(context.stroke).mockImplementation(() => {
      strokeColors.push(String(context.strokeStyle));
    });
    probe.set([{ id: "themed", value: 12 }]);

    chart.updateOptions({ theme: "annotations" });
    requestChartRedraw(chart, "annotations", true);

    expect(strokeColors.at(-1)).toBe("#123456");
    expect(context.fillStyle).toBe("#fedcba");
  });

  it("keeps its owned canvas between drawings and crosshair", () => {
    const { chart } = createChart();
    const canvases = [
      ...getChartContext(chart, "main")
        .canvas.closest(".financial-charts")!
        .querySelectorAll("canvas"),
    ];

    expect(canvases.some((canvas) => canvas.style.zIndex === "60")).toBe(true);
    expect(canvases.some((canvas) => canvas.style.zIndex === "70")).toBe(true);
    expect(canvases.some((canvas) => canvas.style.zIndex === "100")).toBe(true);
  });

  it("rejects ambiguous or invalid provider models", () => {
    const { chart } = createChart();
    const probe = new AnnotationProbe();
    chart.addPlugin(probe);

    expect(() =>
      probe.set([
        { id: "duplicate", value: 10 },
        { id: "duplicate", value: 12 },
      ])
    ).toThrow(/Duplicate price axis annotation id/);
    expect(() => probe.set([{ id: "invalid", value: Number.NaN }])).toThrow(
      /must be finite/
    );
  });
});
