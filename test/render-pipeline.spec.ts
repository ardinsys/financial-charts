import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
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
      start,
      end: data.at(-1)!.time
    },
    {
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
    pipeline.addHook("crosshair", () => calls.push("crosshair"));
    pipeline.addHook("afterDraw", () => calls.push("afterDraw"));

    pipeline.render(["series", "crosshair", "grid"]);

    expect(calls).toEqual([
      "beforeDraw",
      "grid",
      "series",
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
    const beforeDraw = vi.fn();
    const afterDraw = vi.fn();

    const removeBefore = chart.onRenderStage("beforeDraw", beforeDraw);
    const removeAfter = chart.onRenderStage("afterDraw", afterDraw);

    chart.requestRedraw(["grid", "axes", "series"], true);

    expect(beforeDraw).toHaveBeenCalledTimes(1);
    expect(afterDraw).toHaveBeenCalledTimes(1);

    removeBefore();
    removeAfter();
    chart.requestRedraw(["grid", "axes", "series"], true);

    expect(beforeDraw).toHaveBeenCalledTimes(1);
    expect(afterDraw).toHaveBeenCalledTimes(1);
  });
});
