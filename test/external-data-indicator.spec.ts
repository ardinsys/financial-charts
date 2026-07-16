import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData, TimeRange } from "../src/chart/types";
import {
  type DefaultIndicatorOptions,
  Indicator,
  type IndicatorLabelContent
} from "../src/indicators/indicator";
import { getChartModel } from "./chart-test-harness";

interface ExternalIndicatorTheme {
  color: string;
}

class ExternalDataProbeIndicator extends Indicator<
  ExternalIndicatorTheme,
  DefaultIndicatorOptions
> {
  static readonly ID = "external-data-probe";

  readonly onOptionsChanged = vi.fn();
  detachCalls = 0;
  labelReads = 0;
  private prices: number[] = [];
  private requestVersion = 0;

  getDefaultOptions(): DefaultIndicatorOptions {
    return {
      labelKey: "external-data-probe",
      names: { default: "External data" }
    };
  }

  getDefaultThemes(): Record<string, ExternalIndicatorTheme> {
    return {
      light: { color: "#ff0000" },
      dark: { color: "#00ff00" }
    };
  }

  getModifier(_visibleTimeRange: TimeRange) {
    if (this.prices.length === 0) return null;
    return {
      actor: this,
      enabled: true,
      yMin: Math.min(...this.prices),
      yMax: Math.max(...this.prices)
    };
  }

  protected getLabelContent(): IndicatorLabelContent {
    this.labelReads++;
    return {
      detail: String(this.prices.length),
      segments: [{ text: this.theme.color, color: this.theme.color }]
    };
  }

  draw(): void {}

  setPrices(prices: readonly number[]) {
    this.prices = [...prices];
    this.invalidate({ scale: true });
  }

  async load(prices: Promise<readonly number[]>) {
    const version = ++this.requestVersion;
    const { signal } = this.indicatorContext;
    const result = await prices;
    if (version !== this.requestVersion || signal.aborted) {
      return;
    }
    this.setPrices(result);
  }

  getPrices() {
    return [...this.prices];
  }

  getResolvedColor() {
    return this.theme.color;
  }

  getSignal() {
    return this.indicatorContext.signal;
  }

  override detach(): void {
    this.detachCalls++;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const charts: FinancialChart[] = [];

afterEach(() => {
  while (charts.length > 0) charts.pop()?.dispose();
  document.body.innerHTML = "";
});

function createChart() {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "400px";
  document.body.appendChild(container);
  const chart = new FinancialChart(container, {
    type: "line",
    timeRange: "auto",
    stepSize: 60_000,
    maxZoom: 10,
    volume: false,
    locale: "en-US"
  });
  const start = Date.UTC(2024, 0, 1, 9);
  const data: ChartData[] = [10, 12, 14].map((close, index) => ({
    time: start + index * 60_000,
    close
  }));
  chart.setData(data);
  charts.push(chart);
  return { chart, data };
}

describe("external-data indicators", () => {
  it("invalidates labels, drawing, and modifiers without attachment hazards", async () => {
    const { chart, data } = createChart();
    const indicator = new ExternalDataProbeIndicator();

    expect(() => indicator.setPrices([])).not.toThrow();
    chart.addIndicator(indicator);
    const draw = vi.spyOn(indicator, "draw");

    indicator.setPrices([100]);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(getChartModel(chart).getVisibleScale().getYMax()).toBeGreaterThan(
      100
    );
    expect(draw).toHaveBeenCalled();

    indicator.setPrices([]);
    expect(getChartModel(chart).getVisibleScale().getYMax()).toBeLessThan(100);
    indicator.setPrices([100]);

    const labelReads = indicator.labelReads;
    chart.updateOptions({ theme: { key: "dark" } });
    expect(indicator.getResolvedColor()).toBe("#00ff00");
    expect(indicator.labelReads).toBeGreaterThan(labelReads);

    const sameThemeLabelReads = indicator.labelReads;
    chart.updateOptions({
      theme: { key: "dark", backgroundColor: "#101010" }
    });
    expect(indicator.labelReads).toBeGreaterThan(sameThemeLabelReads);

    indicator.onOptionsChanged.mockClear();
    chart.updateOptions({
      timeRange: { start: data[0].time, end: data.at(-1)!.time + 60_000 },
      stepSize: 120_000
    });
    expect(indicator.onOptionsChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        changedKeys: ["timeRange", "stepSize"]
      })
    );
    expect(getChartModel(chart).getVisibleScale().getYMax()).toBeGreaterThan(
      100
    );
  });

  it("rejects stale async results and aborts attachment work on detach", async () => {
    const { chart } = createChart();
    const indicator = new ExternalDataProbeIndicator();
    chart.addIndicator(indicator);
    const signal = indicator.getSignal();
    const first = deferred<readonly number[]>();
    const second = deferred<readonly number[]>();

    const firstLoad = indicator.load(first.promise);
    const secondLoad = indicator.load(second.promise);
    second.resolve([80]);
    await secondLoad;
    first.resolve([200]);
    await firstLoad;

    expect(indicator.getPrices()).toEqual([80]);

    const pending = deferred<readonly number[]>();
    const pendingLoad = indicator.load(pending.promise);
    const removeButton = indicator
      .getLabelContainer()
      .querySelector('[data-id="remove"]') as HTMLElement;
    const onIndicatorRemove = vi.fn();
    chart.on("indicator-remove", onIndicatorRemove);

    chart.removeIndicator(indicator);
    expect(onIndicatorRemove).toHaveBeenCalledOnce();
    onIndicatorRemove.mockClear();
    expect(signal.aborted).toBe(true);
    expect(indicator.detachCalls).toBe(1);

    pending.resolve([300]);
    await pendingLoad;
    expect(indicator.getPrices()).toEqual([80]);

    removeButton.click();
    expect(onIndicatorRemove).not.toHaveBeenCalled();

    const requestRedraw = vi.spyOn(chart, "requestRedraw");
    expect(() => indicator.setPrices([400])).not.toThrow();
    expect(requestRedraw).not.toHaveBeenCalled();
  });
});
