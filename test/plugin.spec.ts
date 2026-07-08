import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { TestIndicator } from "../src/indicators/paneled/test-indicator";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import type { IndicatorLabelRenderer } from "../src/indicators/label-renderer";
import type { ChartPlugin } from "../src/plugin/chart-plugin";

FinancialChart.registerController(LineController);

const charts: FinancialChart[] = [];

class DetachProbeIndicator extends MovingAverageIndicator {
  detachCalls = 0;

  public override detach(): void {
    this.detachCalls++;
    super.detach();
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
    { time: start + 120_000, close: 14 }
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
  charts.push(chart);

  return { chart, data };
}

describe("plugin lifecycle", () => {
  it("creates and attaches built-in indicators from the chart-level registry", () => {
    const { chart, data } = createChart();
    FinancialChart.registerIndicator(MovingAverageIndicator);
    FinancialChart.registerIndicator(TestIndicator);

    const sma =
      FinancialChart.createIndicator<MovingAverageIndicator>("moving-average");
    const testIndicator = FinancialChart.createIndicator<TestIndicator>("test");

    chart.draw(data);
    chart.addIndicator(sma);
    chart.addIndicator(testIndicator);

    expect(sma).toBeInstanceOf(MovingAverageIndicator);
    expect(testIndicator).toBeInstanceOf(TestIndicator);
    expect(chart.getIndicators()).toEqual([sma]);
    expect(chart.getPaneledIndicators()).toEqual([testIndicator]);
    expect(chart.getPanes()).toHaveLength(2);
    expect(
      sma.getLabelContainer().querySelector("[data-id=name]")?.textContent
    ).toBe("Simple Moving Average");
    expect(
      testIndicator.getLabelContainer().querySelector("[data-id=name]")
        ?.textContent
    ).toBe("Test");
  });

  it("renders indicator labels through an injectable renderer", () => {
    const { chart, data } = createChart();
    const renderer: IndicatorLabelRenderer = {
      render: vi.fn(
        ({ themeKey }) => /* html */ `
          <div data-id="custom-label" data-theme="${themeKey}">
            <span data-id="label">
              <span data-id="name"></span>
              <span data-id="extra"></span>
              <span data-id="value"></span>
            </span>
            <button data-id="show"></button>
            <button data-id="hide"></button>
            <button data-id="settings"></button>
            <button data-id="remove"></button>
          </div>
        `
      )
    };
    const indicator = new MovingAverageIndicator(null, {
      labelRenderer: renderer,
      names: {
        default: "Injected SMA"
      }
    });

    chart.draw(data);
    chart.addIndicator(indicator);

    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ themeKey: "light" })
    );
    expect(
      indicator
        .getLabelContainer()
        .querySelector("[data-id=custom-label]")
        ?.getAttribute("data-theme")
    ).toBe("light");
    expect(
      indicator.getLabelContainer().querySelector("[data-id=name]")?.textContent
    ).toBe("Injected SMA");
  });

  it("attaches, draws, notifies, and detaches chart plugins", () => {
    const { chart, data } = createChart();
    const plugin: ChartPlugin = {
      key: "probe",
      attach: vi.fn(),
      beforeDraw: vi.fn(),
      draw: vi.fn(),
      afterDraw: vi.fn(),
      onData: vi.fn(),
      onVisibleRangeChanged: vi.fn(),
      onPointer: vi.fn(),
      detach: vi.fn()
    };

    chart.addPlugin(plugin);
    chart.draw(data);
    chart.requestRedraw("drawings", true);

    const pointerChart = chart as unknown as {
      isTouchCapable: boolean;
      pointerMove(event: { x: number; y: number }): void;
    };
    pointerChart.isTouchCapable = false;
    pointerChart.pointerMove({ x: 360, y: 120 });

    expect(plugin.attach).toHaveBeenCalledOnce();
    expect(plugin.onData).toHaveBeenCalledWith(data);
    expect(plugin.onVisibleRangeChanged).toHaveBeenCalled();
    expect(plugin.beforeDraw).toHaveBeenCalled();
    expect(plugin.draw).toHaveBeenCalled();
    expect(plugin.afterDraw).toHaveBeenCalled();
    expect(plugin.onPointer).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 360,
        y: 120,
        pane: chart.getMainPane()
      })
    );

    chart.removePlugin(plugin);

    expect(chart.getPlugins()).toEqual([]);
    expect(plugin.detach).toHaveBeenCalledOnce();
  });

  it("detaches indicator label listeners when indicators are removed", () => {
    const { chart, data } = createChart();
    chart.draw(data);
    const indicator = new DetachProbeIndicator();
    const emitSpy = vi.spyOn(chart, "emit");

    for (let i = 1; i <= 3; i++) {
      chart.addIndicator(indicator);
      const removeButton = indicator
        .getLabelContainer()
        .querySelector('[data-id="remove"]') as HTMLElement;

      chart.removeIndicator(indicator);
      removeButton.click();

      expect(indicator.detachCalls).toBe(i);
      expect(emitSpy).not.toHaveBeenCalledWith(
        "indicator-remove",
        expect.anything()
      );
      emitSpy.mockClear();
    }
  });

  it("detaches indicators and plugins and clears chart listeners on dispose", () => {
    const { chart, data } = createChart();
    const indicator = new DetachProbeIndicator();
    const plugin: ChartPlugin = {
      key: "dispose-probe",
      attach: vi.fn(),
      detach: vi.fn()
    };

    chart.draw(data);
    chart.addIndicator(indicator);
    chart.addPlugin(plugin);
    chart.on("click", vi.fn());

    expect(chart.listenerCount("click")).toBe(1);

    chart.dispose();
    charts.pop();

    expect(indicator.detachCalls).toBe(1);
    expect(plugin.detach).toHaveBeenCalledOnce();
    expect(chart.listenerCount("click")).toBe(0);
  });
});
