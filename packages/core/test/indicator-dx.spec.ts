import { afterEach, describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import {
  DefaultIndicatorOptions,
  Indicator,
  type IndicatorDrawingContext,
  type IndicatorLabelContent,
} from "../src/indicators/indicator";
import {
  PaneledIndicator,
  type PaneledIndicatorDrawingContext,
} from "../src/indicators/paneled-indicator";
import { DataScaleModel } from "../src/scales/data-scale-model";
import type { ExtensionThemeDefaults } from "../src/plugin/extension-theme";
import {
  getChartContext,
  getChartModel,
  getInternalPanes,
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

class OverlayProbeIndicator extends Indicator<{}, DefaultIndicatorOptions> {
  static readonly ID = "overlay-probe";
  lastContext?: IndicatorDrawingContext;

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      labelKey: "overlay-probe",
      names: { default: "Overlay probe" },
    };
  }

  public getDefaultThemes(): ExtensionThemeDefaults<{}> {
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
  static readonly ID = "paneled-probe";
  lastContext?: PaneledIndicatorDrawingContext;

  public createScale(): DataScaleModel {
    return new DataScaleModel(
      "simple",
      this.indicatorContext.getData(),
      this.indicatorContext.getVisibleTimeRange()
    );
  }

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      labelKey: "paneled-probe",
      names: { default: "Paneled probe" },
    };
  }

  public getDefaultThemes(): ExtensionThemeDefaults<{}> {
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
  return chart;
}

function createData() {
  const start = Date.UTC(2024, 0, 1, 9);
  return [
    { time: start, close: 10 },
    { time: start + 60_000, close: 12 },
    { time: start + 120_000, close: 14 },
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

    expect(indicator.lastContext?.ctx).toBe(
      getChartContext(chart, "indicator")
    );
    expect(indicator.lastContext?.canvas).toBe(
      getChartContext(chart, "indicator").canvas
    );
    expect(indicator.lastContext?.data).toEqual(chart.getData());
    expect(indicator.lastContext?.visibleData).toEqual(
      getChartModel(chart).getVisibleDataPoints()
    );
    expect(indicator.lastContext?.visibleTimeRange).toEqual(
      chart.getVisibleTimeRange()
    );
    expect(
      indicator.lastContext?.projectPoint(chart.getData()[0].time, 10)
    ).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      })
    );
  });

  it("prepares paneled indicator drawing state before calling the pane draw body", async () => {
    const chart = createChart(createData());
    const indicator = new PaneledProbeIndicator();

    chart.addIndicator(indicator);
    await waitForRedraw();

    const [, pane] = getInternalPanes(chart);
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
    expect(
      indicator.lastContext?.projectPoint(chart.getData()[0].time, 10)
    ).toEqual(
      expect.objectContaining({
        x: expect.any(Number),
        y: expect.any(Number),
      })
    );
  });
});

describe("indicator identity", () => {
  it("separates generated instance identity from type and label identity", () => {
    const first = new MovingAverageIndicator();
    const second = new MovingAverageIndicator();

    expect(first.getInstanceId()).not.toBe(second.getInstanceId());
    expect(first.getIndicatorType()).toBe("moving-average");
    expect(second.getIndicatorType()).toBe("moving-average");
    expect(first.getLabelKey()).toBe("SMA");
  });

  it("restores caller-provided IDs and rejects duplicates on one chart", () => {
    const chart = createChart(createData());
    const first = new MovingAverageIndicator(null, {
      instanceId: "primary-sma",
    });
    const duplicate = new MovingAverageIndicator(null, {
      instanceId: "primary-sma",
    });

    chart.addIndicator(first);

    expect(chart.getIndicatorById("primary-sma")).toBe(first);
    expect(chart.getIndicatorsByType("moving-average")).toEqual([first]);
    expect(() => chart.addIndicator(duplicate)).toThrow(
      'Indicator instanceId "primary-sma" is already attached to this chart.'
    );
  });

  it("gives clones new identity while copyFrom preserves target identity", () => {
    const source = new MovingAverageIndicator(null, {
      instanceId: "source-sma",
      period: 21,
    });
    const clone = source.clone();
    const target = new MovingAverageIndicator(null, {
      instanceId: "target-sma",
    });

    target.copyFrom(source);
    source.updateOptions({ period: 34 });

    expect(clone.getInstanceId()).not.toBe(source.getInstanceId());
    expect(clone.getOptions().period).toBe(21);
    expect(target.getInstanceId()).toBe("target-sma");
    expect(target.getOptions().period).toBe(21);
    expect(source.getOptions().period).toBe(34);
  });

  it("provides the indicator instance in indicator events", () => {
    const chart = createChart(createData());
    const indicator = new MovingAverageIndicator(null, {
      instanceId: "event-sma",
    });
    const events: Indicator<any, any>[] = [];
    chart.on("indicator-add", ({ indicator: eventIndicator }) => {
      events.push(eventIndicator);
    });
    chart.on("indicator-change", ({ indicator: eventIndicator }) => {
      events.push(eventIndicator);
    });
    chart.on("indicator-remove", ({ indicator: eventIndicator }) => {
      events.push(eventIndicator);
    });

    chart.addIndicator(indicator);
    indicator.updateOptions({ period: 12 });
    chart.removeIndicator(indicator);

    expect(events).toEqual([indicator, indicator, indicator]);
  });
});
