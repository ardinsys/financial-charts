import { afterEach, describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import {
  DefaultIndicatorOptions,
  Indicator,
  type IndicatorDrawingContext,
  type IndicatorLabelContent
} from "../src/indicators/indicator";
import {
  PaneledIndicator,
  type PaneledIndicatorDrawingContext
} from "../src/indicators/paneled-indicator";
import { DataScaleModel } from "../src/scales/data-scale-model";

const charts: FinancialChart[] = [];

class OverlayProbeIndicator extends Indicator<{}, DefaultIndicatorOptions> {
  lastContext?: IndicatorDrawingContext;

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      key: "overlay-probe",
      names: { default: "Overlay probe" }
    };
  }

  public getDefaultThemes(): Record<string, {}> {
    return { light: {}, dark: {} };
  }

  public draw(): void {
    this.lastContext = this.getDrawingContext();
    const first = this.lastContext.visibleData[0];
    if (!first?.close) return;
    const point = this.lastContext.projectPoint(first.time, first.close);
    this.lastContext.ctx.fillRect(point.x, point.y, 1, 1);
  }

  protected getLabelContent(): IndicatorLabelContent {
    return {};
  }
}

class PaneledProbeIndicator extends PaneledIndicator<
  {},
  DefaultIndicatorOptions
> {
  lastContext?: PaneledIndicatorDrawingContext;

  public createScale(): DataScaleModel {
    return this.chart.getVisibleScale();
  }

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      key: "paneled-probe",
      names: { default: "Paneled probe" }
    };
  }

  public getDefaultThemes(): Record<string, {}> {
    return { light: {}, dark: {} };
  }

  public getCrosshairValue(_time: number, _relativeY: number): string {
    return "Pane value";
  }

  protected drawPane(context: PaneledIndicatorDrawingContext): void {
    this.lastContext = context;
    const first = context.visibleData[0];
    if (!first?.close) return;
    const point = context.projectPoint(first.time, first.close);
    context.ctx.fillRect(point.x, point.y, 1, 1);
  }

  protected getLabelContent(): IndicatorLabelContent {
    return {};
  }
}

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

  const chart = new FinancialChart(
    container,
    {
      timeRange: {
        start: data[0].time,
        end: data.at(-1)!.time + 60_000
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

function createData() {
  const start = Date.UTC(2024, 0, 1, 9);
  return [
    { time: start, close: 10 },
    { time: start + 60_000, close: 12 },
    { time: start + 120_000, close: 14 }
  ];
}

function waitForRedraw() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

describe("indicator authoring contexts", () => {
  it("provides overlay indicators with canvas, data, scales, and projection helpers", async () => {
    const chart = createChart(createData());
    const indicator = new OverlayProbeIndicator();

    chart.addIndicator(indicator);
    await waitForRedraw();

    expect(indicator.lastContext?.ctx).toBe(chart.getContext("indicator"));
    expect(indicator.lastContext?.canvas).toBe(
      chart.getContext("indicator").canvas
    );
    expect(indicator.lastContext?.data).toEqual(chart.getData());
    expect(indicator.lastContext?.visibleData).toEqual(
      chart.getLastVisibleDataPoints()
    );
    expect(indicator.lastContext?.visibleTimeRange).toEqual(
      chart.getVisibleTimeRange()
    );
    expect(
      indicator.lastContext?.projectPoint(chart.getData()[0].time, 10)
    ).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number)
      })
    );
  });

  it("prepares paneled indicator chrome before calling the pane draw body", async () => {
    const chart = createChart(createData());
    const indicator = new PaneledProbeIndicator();

    chart.addIndicator(indicator);
    await waitForRedraw();

    const [, pane] = chart.getPanes();
    expect(indicator.lastContext?.pane).toBe(pane);
    expect(indicator.lastContext?.ctx.canvas.parentElement).toBe(
      indicator.getContainer()
    );
    expect(indicator.lastContext?.axisCtx.canvas.parentElement).toBe(
      indicator.getContainer()
    );
    expect(indicator.lastContext?.width).toBe(720);
    expect(indicator.lastContext?.height).toBe(92.5);
    expect(indicator.lastContext?.axisWidth).toBe(80);
    expect(indicator.lastContext?.priceScale).toBe(pane.getPriceScale());
    expect(
      indicator.lastContext?.projectPoint(chart.getData()[0].time, 10)
    ).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number)
      })
    );
  });
});
