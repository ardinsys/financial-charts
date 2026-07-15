import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import type { ChartContext, ChartPlugin } from "../src/plugin/chart-plugin";
import { RenderPipeline } from "../src/render/render-pipeline";

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  document.body.innerHTML = "";
});

function createChart(data: ChartData[]) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);

  const start = data[0].time;
  const chart = new FinancialChart(
    container,
    {
      timeRange: {
        start,
        end: data.at(-1)!.time
      },
      type: "line",
      controllers: [LineController],
      stepSize: 60_000,
      maxZoom: 10,
      volume: false,
      locale: "en-US"
    }
  );

  chart.setData(data);
  charts.push(chart);
  return chart;
}

function attachRenderContext(chart: FinancialChart): ChartContext {
  let context: ChartContext | undefined;
  const plugin: ChartPlugin = {
    key: `render-probe-${charts.length}`,
    attach: (ctx) => {
      context = ctx;
    }
  };
  chart.addPlugin(plugin);
  return context!;
}

describe("RenderPipeline", () => {
  it("runs requested stages between before/after hooks in stage order", () => {
    const pipeline = new RenderPipeline();
    const calls: string[] = [];

    pipeline.addHook("beforeDraw", () => calls.push("beforeDraw"));
    pipeline.addHook("grid", () => calls.push("grid"));
    pipeline.addHook("axes", () => calls.push("axes"));
    pipeline.addHook("series", () => calls.push("series"));
    pipeline.addHook("indicators", () => calls.push("indicators"));
    pipeline.addHook("drawings", () => calls.push("drawings"));
    pipeline.addHook("annotations", () => calls.push("annotations"));
    pipeline.addHook("crosshair", () => calls.push("crosshair"));
    pipeline.addHook("afterDraw", () => calls.push("afterDraw"));

    pipeline.render(["series", "crosshair", "grid", "annotations"]);

    expect(calls).toEqual([
      "beforeDraw",
      "grid",
      "series",
      "annotations",
      "crosshair",
      "afterDraw"
    ]);
  });

  it("allows chart before/after draw hooks to be attached and removed", () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart([
      { time: start, close: 10 },
      { time: start + 60_000, close: 11 }
    ]);
    const context = attachRenderContext(chart);
    const beforeDraw = vi.fn();
    const afterDraw = vi.fn();

    const removeBefore = context.onRenderStage("beforeDraw", beforeDraw);
    const removeAfter = context.onRenderStage("afterDraw", afterDraw);

    context.requestRedraw(["grid", "axes", "series"], true);

    expect(beforeDraw).toHaveBeenCalledTimes(1);
    expect(afterDraw).toHaveBeenCalledTimes(1);

    removeBefore();
    removeAfter();
    context.requestRedraw(["grid", "axes", "series"], true);

    expect(beforeDraw).toHaveBeenCalledTimes(1);
    expect(afterDraw).toHaveBeenCalledTimes(1);
  });

  it("coalesces repeated layer invalidations into one frame", async () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart([
      { time: start, close: 10 },
      { time: start + 60_000, close: 11 }
    ]);
    const context = attachRenderContext(chart);
    context.requestRedraw(["grid", "axes"], true);
    const beforeDraw = vi.fn();
    const grid = vi.fn();
    const axes = vi.fn();
    const afterDraw = vi.fn();
    context.onRenderStage("beforeDraw", beforeDraw);
    context.onRenderStage("grid", grid);
    context.onRenderStage("axes", axes);
    context.onRenderStage("afterDraw", afterDraw);

    context.requestRedraw("grid");
    context.requestRedraw("axes");
    context.requestRedraw("grid");
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(beforeDraw).toHaveBeenCalledOnce();
    expect(grid).toHaveBeenCalledOnce();
    expect(axes).toHaveBeenCalledOnce();
    expect(afterDraw).toHaveBeenCalledOnce();
  });

  it("schedules invalidations raised during rendering for the next frame", async () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart([
      { time: start, close: 10 },
      { time: start + 60_000, close: 11 }
    ]);
    const context = attachRenderContext(chart);
    context.requestRedraw("grid", true);
    const beforeDraw = vi.fn();
    const axes = vi.fn();
    context.onRenderStage("beforeDraw", beforeDraw);
    context.onRenderStage("grid", () => context.requestRedraw("axes"));
    context.onRenderStage("axes", axes);

    context.requestRedraw("grid");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(beforeDraw).toHaveBeenCalledTimes(2);
    expect(axes).toHaveBeenCalledOnce();
  });

  it("cancels a pending frame when the chart is disposed", async () => {
    const start = Date.UTC(2024, 0, 1, 9);
    const chart = createChart([
      { time: start, close: 10 },
      { time: start + 60_000, close: 11 }
    ]);
    const context = attachRenderContext(chart);
    context.requestRedraw("grid", true);
    const grid = vi.fn();
    context.onRenderStage("grid", grid);

    context.requestRedraw("grid");
    chart.dispose();
    charts.pop();
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(grid).not.toHaveBeenCalled();
  });
});
