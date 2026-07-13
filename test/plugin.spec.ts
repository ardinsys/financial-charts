import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import type { Drawing } from "../src/drawings";
import { TestIndicator } from "../src/indicators/paneled/test-indicator";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import type { ChartPlugin } from "../src/plugin/chart-plugin";

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
  charts.push(chart);

  return { chart, data };
}

describe("plugin lifecycle", () => {
  it("attaches built-in indicator instances directly", () => {
    const { chart, data } = createChart();
    const sma = new MovingAverageIndicator();
    const testIndicator = new TestIndicator();

    chart.setData(data);
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

  it("renders indicator label content from the data model", () => {
    const { chart, data } = createChart();
    const indicator = new MovingAverageIndicator(null, {
      names: { default: "Injected SMA" }
    });

    chart.setData(data);
    chart.addIndicator(indicator);

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
    chart.setData(data);
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

  it("returns immutable snapshots for public collections", () => {
    const { chart, data } = createChart();
    const overlay = new MovingAverageIndicator();
    const paneled = new TestIndicator();
    const plugin: ChartPlugin = {
      key: "snapshot-probe",
      attach: vi.fn()
    };

    chart.setData(data);
    chart.addIndicator(overlay);
    chart.addIndicator(paneled);
    chart.addPlugin(plugin);

    const snapshots: readonly (readonly unknown[])[] = [
      chart.getData(),
      chart.getLastVisibleDataPoints(),
      chart.getLastXGridCoords(),
      chart.getIndicators(),
      chart.getPaneledIndicators(),
      chart.getAllIndicators(),
      chart.getPanes(),
      chart.getPlugins()
    ];

    for (const snapshot of snapshots) {
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(() => (snapshot as unknown[]).push({})).toThrow(TypeError);
    }

    expect(chart.getLastVisibleDataPoints()).toBe(
      chart.getLastVisibleDataPoints()
    );
    expect(chart.getLastXGridCoords()).toBe(chart.getLastXGridCoords());
    expect(chart.getData()).toHaveLength(data.length);
    expect(chart.getIndicators()).toEqual([overlay]);
    expect(chart.getPaneledIndicators()).toEqual([paneled]);
    expect(chart.getPlugins()).toEqual([plugin]);
  });

  it("rejects duplicate plugin registrations and indicator instances", () => {
    const { chart } = createChart();
    const plugin: ChartPlugin = {
      key: "unique-probe",
      attach: vi.fn()
    };
    const duplicateKeyPlugin: ChartPlugin = {
      key: "unique-probe",
      attach: vi.fn()
    };
    const indicator = new MovingAverageIndicator();

    chart.addPlugin(plugin);
    chart.addIndicator(indicator);

    expect(() => chart.addPlugin(plugin)).toThrow(
      "Plugin instance is already attached to this chart."
    );
    expect(() => chart.addPlugin(duplicateKeyPlugin)).toThrow(
      'Plugin key "unique-probe" is already registered on this chart.'
    );
    expect(() => chart.addIndicator(indicator)).toThrow(
      "Indicator instance is already attached to this chart."
    );
    expect(plugin.attach).toHaveBeenCalledOnce();
    expect(duplicateKeyPlugin.attach).not.toHaveBeenCalled();
  });

  it("returns idempotent disposers from extension registration", () => {
    const { chart } = createChart();
    const indicator = new DetachProbeIndicator();
    const plugin: ChartPlugin = {
      key: "disposer-probe",
      attach: vi.fn(),
      detach: vi.fn()
    };

    const removeIndicator = chart.addIndicator(indicator);
    const removePlugin = chart.addPlugin(plugin);

    removeIndicator();
    removeIndicator();
    removePlugin();
    removePlugin();
    expect(chart.removeIndicator(indicator)).toBe(false);
    expect(chart.removePlugin(plugin)).toBe(false);
    expect(indicator.detachCalls).toBe(1);
    expect(plugin.detach).toHaveBeenCalledOnce();
  });

  it("exposes canvas and event helpers through the plugin context", () => {
    const { chart } = createChart();
    let attachedContext: Parameters<ChartPlugin["attach"]>[0] | undefined;
    const siblingPlugin: ChartPlugin = {
      key: "sibling-probe",
      attach: vi.fn()
    };
    const plugin: ChartPlugin = {
      key: "context-probe",
      attach: (ctx) => {
        attachedContext = ctx;
      }
    };
    const selectListener = vi.fn();
    const unsubscribe = chart.on("drawing-select", selectListener);

    chart.addPlugin(siblingPlugin);
    chart.addPlugin(plugin);

    expect(attachedContext?.getCanvasContext("drawings")).toBe(
      chart.getContext("drawings")
    );
    expect(attachedContext?.getLogicalCanvas("drawings")).toEqual(
      chart.getLogicalCanvas("drawings")
    );
    expect(attachedContext?.getPlugin("sibling-probe")).toBe(siblingPlugin);
    expect(attachedContext?.getPlugin("context-probe")).toBe(plugin);
    expect(attachedContext?.getPlugin("missing-probe")).toBeUndefined();
    expect(attachedContext?.getPlugins()).toEqual([siblingPlugin, plugin]);

    const drawing = {} as Drawing;
    attachedContext?.emit("drawing-select", { drawing });
    attachedContext?.emit("drawing-select", { drawing: undefined });

    expect(selectListener).toHaveBeenCalledWith({ drawing });
    expect(selectListener).toHaveBeenCalledWith({ drawing: undefined });
    unsubscribe();
  });

  it("lets plugins drive the native crosshair state", () => {
    const { chart, data } = createChart();
    let attachedContext: Parameters<ChartPlugin["attach"]>[0] | undefined;
    const plugin: ChartPlugin = {
      key: "crosshair-probe",
      attach: (ctx) => {
        attachedContext = ctx;
      }
    };
    const internals = chart as unknown as {
      crosshairDataPoint: ChartData | null;
      isProgrammaticCrosshair: boolean;
      pointerTime: number;
      pointerY: number;
    };

    chart.setData(data);
    chart.addPlugin(plugin);

    const state = attachedContext?.setCrosshair({
      time: data[1].time + 10_000
    });

    expect(state).toEqual(
      expect.objectContaining({
        time: data[1].time,
        dataPoint: data[1],
        pane: chart.getMainPane()
      })
    );
    expect(internals.crosshairDataPoint).toEqual(data[1]);
    expect(internals.pointerTime).toBe(data[1].time);
    expect(internals.pointerY).toBeGreaterThan(0);
    expect(internals.isProgrammaticCrosshair).toBe(true);

    attachedContext?.clearCrosshair();

    expect(internals.crosshairDataPoint).toBeNull();
    expect(internals.pointerTime).toBe(-1);
    expect(internals.pointerY).toBe(-1);
    expect(internals.isProgrammaticCrosshair).toBe(false);
  });

  it("detaches indicator label listeners when indicators are removed", () => {
    const { chart, data } = createChart();
    chart.setData(data);
    const indicator = new DetachProbeIndicator();
    const emitSpy = vi.spyOn(chart, "emit");

    for (let i = 1; i <= 3; i++) {
      chart.addIndicator(indicator);
      emitSpy.mockClear();
      const removeButton = indicator
        .getLabelContainer()
        .querySelector('[data-id="remove"]') as HTMLElement;

      chart.removeIndicator(indicator);
      emitSpy.mockClear();
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

    chart.setData(data);
    chart.addIndicator(indicator);
    chart.addPlugin(plugin);
    chart.on("click", vi.fn());

    expect(chart.listenerCount("click")).toBe(1);

    chart.dispose();
    chart.dispose();
    charts.pop();

    expect(indicator.detachCalls).toBe(1);
    expect(plugin.detach).toHaveBeenCalledOnce();
    expect(chart.listenerCount("click")).toBe(0);
    expect(() => chart.addIndicator(new DetachProbeIndicator())).toThrow(
      "Cannot add an indicator to a disposed chart."
    );
    expect(() => chart.addPlugin(plugin)).toThrow(
      "Cannot add a plugin to a disposed chart."
    );
  });
});
