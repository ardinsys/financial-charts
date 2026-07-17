import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartEventMap } from "../src/chart/event-emitter";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import type { Drawing } from "../src/drawings";
import { TestIndicator } from "./fixtures/test-indicator";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import type { ChartContext, ChartPlugin } from "../src/plugin/chart-plugin";
import {
  getChartContext,
  getExtensionHost,
  getInternalMainPane,
  requestChartRedraw
} from "./chart-test-harness";

const charts: FinancialChart[] = [];

class DetachProbeIndicator extends MovingAverageIndicator {
  detachCalls = 0;

  public override detach(): void {
    this.detachCalls++;
    super.detach();
  }
}

class ThrowingDetachIndicator extends MovingAverageIndicator {
  shouldThrow = true;

  public override detach(): void {
    if (this.shouldThrow) throw new Error("indicator detach failed");
    super.detach();
  }
}

class LifecycleProbeIndicator extends MovingAverageIndicator {
  onData = vi.fn();
  onVisibleRangeChanged = vi.fn();
  onOptionsChanged = vi.fn();
  onPointer = vi.fn();
  onDrawingFinished = vi.fn();
}

class RemovingIndicator extends MovingAverageIndicator {
  removeTarget?: () => void;

  onData(data: readonly ChartData[]) {
    if (data.length > 0) this.removeTarget?.();
  }
}

class PointerPaneIndicator extends TestIndicator {
  onData = vi.fn();
  onPointer = vi.fn();
}

class EventSourcePlugin implements ChartPlugin {
  readonly key = "event-source";
  private context?: ChartContext;

  attach(context: ChartContext): void {
    this.context = context;
  }

  emit<K extends keyof ChartEventMap>(event: K, data: ChartEventMap[K]): void {
    this.context?.emit(event, data);
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

  const chart = new FinancialChart(container, {
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
  });
  charts.push(chart);

  return { chart, container, data };
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
    expect(chart.getIndicators()).toEqual([sma, testIndicator]);
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
    requestChartRedraw(chart, "drawings", true);

    getChartContext(chart, "crosshair").canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 360,
        clientY: 120,
        bubbles: true
      })
    );

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
        pane: getInternalMainPane(chart)
      })
    );

    chart.removePlugin(plugin);

    expect(chart.getPlugins()).toEqual([]);
    expect(plugin.detach).toHaveBeenCalledOnce();
  });

  it("delivers current and subsequent lifecycle state to extensions", () => {
    const { chart, data } = createChart();
    const indicator = new LifecycleProbeIndicator();
    const draw = vi.spyOn(indicator, "draw");
    const pluginHooks = {
      onData: vi.fn(),
      onVisibleRangeChanged: vi.fn(),
      onOptionsChanged: vi.fn(),
      onDrawingFinished: vi.fn()
    };
    let pluginContext: ChartContext | undefined;
    const plugin: ChartPlugin = {
      key: "lifecycle-probe",
      attach: vi.fn((context) => {
        pluginContext = context;
      }),
      ...pluginHooks
    };

    chart.setData(data);
    chart.addIndicator(indicator);
    chart.addPlugin(plugin);

    const initialOptions = indicator.onOptionsChanged.mock.calls[0][0];
    const initialData = indicator.onData.mock.calls[0][0];
    expect(initialOptions.changedKeys).toEqual([]);
    expect(initialOptions.previous).toBe(initialOptions.current);
    expect(initialOptions.current).toBe(chart.getOptions());
    expect(initialOptions.current).toMatchObject({
      type: "line",
      timeRange: expect.any(Object),
      stepSize: 60_000
    });
    expect(initialData).toEqual(chart.getData());
    expect(initialData).toBe(chart.getData());
    expect(indicator.onVisibleRangeChanged).toHaveBeenCalledWith(
      chart.getVisibleTimeRange()
    );
    expect(pluginHooks.onOptionsChanged).toHaveBeenCalledWith(
      expect.objectContaining({ changedKeys: [] })
    );
    expect(pluginHooks.onData).toHaveBeenCalledWith(chart.getData());
    expect(pluginHooks.onVisibleRangeChanged).toHaveBeenCalledWith(
      chart.getVisibleTimeRange()
    );

    indicator.onData.mockClear();
    indicator.onOptionsChanged.mockClear();
    indicator.onDrawingFinished.mockClear();
    pluginHooks.onData.mockClear();
    pluginHooks.onOptionsChanged.mockClear();
    pluginHooks.onDrawingFinished.mockClear();
    draw.mockClear();

    chart.updateData({
      time: data.at(-1)!.time + 60_000,
      close: 16
    });
    expect(indicator.onData).toHaveBeenCalledWith(chart.getData());
    expect(pluginHooks.onData).toHaveBeenCalledWith(chart.getData());
    expect(indicator.onData.mock.calls[0][0]).toBe(chart.getData());
    expect(pluginHooks.onData.mock.calls[0][0]).toBe(chart.getData());

    chart.updateOptions({ maxZoom: 20 });
    expect(indicator.onOptionsChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        changedKeys: ["maxZoom"],
        current: expect.objectContaining({ maxZoom: 20 })
      })
    );
    expect(pluginHooks.onOptionsChanged).toHaveBeenCalledWith(
      expect.objectContaining({ changedKeys: ["maxZoom"] })
    );

    const drawingEvent = {
      operation: "create"
    } as ChartEventMap["drawing-finished"];
    const publicDrawingFinished = vi.fn();
    chart.on("drawing-finished", publicDrawingFinished);
    pluginContext!.emit("drawing-finished", drawingEvent);
    expect(indicator.onDrawingFinished).toHaveBeenCalledWith(drawingEvent);
    expect(pluginHooks.onDrawingFinished).toHaveBeenCalledWith(drawingEvent);
    expect(publicDrawingFinished).toHaveBeenCalledWith(drawingEvent);

    requestChartRedraw(chart, "indicators", true);
    expect(draw).toHaveBeenCalledOnce();
  });

  it("stops current-state delivery when an extension removes itself", () => {
    const { chart } = createChart();
    const onData = vi.fn();
    const onVisibleRangeChanged = vi.fn();
    const detach = vi.fn();
    let removeSelf = () => {};
    const plugin: ChartPlugin = {
      key: "self-removing-probe",
      attach: vi.fn((ctx) => {
        removeSelf = ctx.remove;
      }),
      onOptionsChanged: () => removeSelf(),
      onData,
      onVisibleRangeChanged,
      detach
    };

    const remove = chart.addPlugin(plugin);

    expect(chart.getPlugins()).toEqual([]);
    expect(onData).not.toHaveBeenCalled();
    expect(onVisibleRangeChanged).not.toHaveBeenCalled();
    expect(detach).toHaveBeenCalledOnce();
    expect(remove()).toBeUndefined();
    expect(detach).toHaveBeenCalledOnce();
  });

  it("dispatches pointers from topmost extensions until consumed", () => {
    const { chart, data } = createChart();
    const order: string[] = [];
    const lifecycleOrder: string[] = [];
    let consumeTopPlugin = false;
    const overlayOne = new LifecycleProbeIndicator();
    const overlayTwo = new LifecycleProbeIndicator();
    const paneled = new PointerPaneIndicator();
    overlayOne.onPointer.mockImplementation(() => {
      order.push("overlay-1");
    });
    overlayTwo.onPointer.mockImplementation(() => {
      order.push("overlay-2");
    });
    paneled.onPointer.mockImplementation(() => {
      order.push("paneled");
    });
    overlayOne.onData.mockImplementation(() => {
      lifecycleOrder.push("overlay-1");
    });
    overlayTwo.onData.mockImplementation(() => {
      lifecycleOrder.push("overlay-2");
    });
    paneled.onData.mockImplementation(() => {
      lifecycleOrder.push("paneled");
    });
    const pluginOne: ChartPlugin = {
      key: "pointer-1",
      attach: vi.fn(),
      onData: () => {
        lifecycleOrder.push("plugin-1");
      },
      onPointer: () => {
        order.push("plugin-1");
      }
    };
    const pluginTwo: ChartPlugin = {
      key: "pointer-2",
      attach: vi.fn(),
      onData: () => {
        lifecycleOrder.push("plugin-2");
      },
      onPointer: () => {
        order.push("plugin-2");
        return consumeTopPlugin;
      }
    };

    chart.setData(data);
    chart.addIndicator(overlayOne);
    chart.addIndicator(overlayTwo);
    chart.addIndicator(paneled);
    chart.addPlugin(pluginOne);
    chart.addPlugin(pluginTwo);

    lifecycleOrder.length = 0;
    chart.updateData({
      time: data.at(-1)!.time + 60_000,
      close: 16
    });
    expect(lifecycleOrder).toEqual([
      "overlay-1",
      "overlay-2",
      "paneled",
      "plugin-1",
      "plugin-2"
    ]);

    const canvas = getChartContext(chart, "crosshair").canvas;
    const pointerDown = () =>
      canvas.dispatchEvent(
        new PointerEvent("pointerdown", {
          clientX: 100,
          clientY: 100,
          pointerType: "mouse",
          button: 0,
          bubbles: true
        })
      );

    pointerDown();
    expect(order).toEqual([
      "plugin-2",
      "plugin-1",
      "paneled",
      "overlay-2",
      "overlay-1"
    ]);

    order.length = 0;
    consumeTopPlugin = true;
    pointerDown();
    expect(order).toEqual(["plugin-2"]);
  });

  it("skips indicators removed earlier in a lifecycle notification", () => {
    const { chart, data } = createChart();
    const remover = new RemovingIndicator();
    const removed = new LifecycleProbeIndicator();
    remover.removeTarget = () => chart.removeIndicator(removed);

    chart.addIndicator(remover);
    chart.addIndicator(removed);
    removed.onData.mockClear();

    chart.setData(data);

    expect(removed.onData).not.toHaveBeenCalled();
    expect(chart.getIndicators()).toEqual([remover]);
  });

  it("returns stable readonly snapshots for public collections", () => {
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

    expect(chart.getData()).toBe(chart.getData());
    expect(chart.getIndicators()).toBe(chart.getIndicators());
    expect(chart.getPanes()).toBe(chart.getPanes());
    expect(chart.getPlugins()).toBe(chart.getPlugins());
    expect(chart.getIndicatorsByType("moving-average")).not.toBe(
      chart.getIndicatorsByType("moving-average")
    );
    expect(chart.getData()).toHaveLength(data.length);
    expect(chart.getIndicators()).toEqual([overlay, paneled]);
    expect(chart.getPlugins()).toEqual([plugin]);
  });

  it("replaces only collection snapshots affected by mutations", () => {
    const { chart } = createChart();
    const overlay = new MovingAverageIndicator();
    const paneled = new TestIndicator();
    const plugin: ChartPlugin = {
      key: "snapshot-invalidation-probe",
      attach: vi.fn()
    };
    const host = getExtensionHost(chart);
    const initialOverlayIndicators = host.getIndicators();
    const initialPaneledIndicators = host.getPaneledIndicators();
    const initialIndicators = chart.getIndicators();
    const initialPanes = chart.getPanes();
    const initialPlugins = chart.getPlugins();

    chart.addIndicator(overlay);
    expect(chart.getIndicators()).not.toBe(initialIndicators);
    expect(host.getIndicators()).not.toBe(initialOverlayIndicators);
    expect(host.getPaneledIndicators()).toBe(initialPaneledIndicators);
    expect(chart.getPanes()).toBe(initialPanes);
    expect(chart.getPlugins()).toBe(initialPlugins);

    const overlaySnapshot = host.getIndicators();
    const allWithOverlay = chart.getIndicators();
    chart.addIndicator(paneled);
    expect(host.getIndicators()).toBe(overlaySnapshot);
    expect(host.getPaneledIndicators()).not.toBe(initialPaneledIndicators);
    expect(chart.getIndicators()).not.toBe(allWithOverlay);
    expect(chart.getPanes()).not.toBe(initialPanes);
    expect(chart.getPlugins()).toBe(initialPlugins);

    const panesWithIndicator = chart.getPanes();
    chart.addPlugin(plugin);
    expect(host.getIndicators()).toBe(overlaySnapshot);
    expect(chart.getPanes()).toBe(panesWithIndicator);
    expect(chart.getPlugins()).not.toBe(initialPlugins);

    const pluginsWithPlugin = chart.getPlugins();
    chart.removePlugin(plugin);
    expect(chart.getPlugins()).not.toBe(pluginsWithPlugin);
    expect(host.getIndicators()).toBe(overlaySnapshot);

    const paneledSnapshot = host.getPaneledIndicators();
    chart.removeIndicator(paneled);
    expect(host.getPaneledIndicators()).not.toBe(paneledSnapshot);
    expect(chart.getPanes()).not.toBe(panesWithIndicator);
    expect(host.getIndicators()).toBe(overlaySnapshot);

    chart.removeIndicator(overlay);
    expect(host.getIndicators()).not.toBe(overlaySnapshot);
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

  it("detaches extensions once in reverse registration order", () => {
    const { chart } = createChart();
    const order: string[] = [];
    const firstIndicator = new DetachProbeIndicator();
    const secondIndicator = new DetachProbeIndicator();
    vi.spyOn(firstIndicator, "detach").mockImplementation(() => {
      order.push("first-indicator");
    });
    vi.spyOn(secondIndicator, "detach").mockImplementation(() => {
      order.push("second-indicator");
    });
    const firstPlugin: ChartPlugin = {
      key: "first-dispose-plugin",
      attach: () => undefined,
      detach: () => order.push("first-plugin")
    };
    const secondPlugin: ChartPlugin = {
      key: "second-dispose-plugin",
      attach: () => undefined,
      detach: () => {
        order.push("second-plugin");
        chart.removePlugin(firstPlugin);
      }
    };

    chart.addIndicator(firstIndicator);
    chart.addIndicator(secondIndicator);
    chart.addPlugin(firstPlugin);
    chart.addPlugin(secondPlugin);
    chart.dispose();
    charts.pop();

    expect(order).toEqual([
      "second-indicator",
      "first-indicator",
      "second-plugin",
      "first-plugin"
    ]);
  });

  it("exposes canvas and event helpers through the plugin context", () => {
    const { chart, container, data } = createChart();
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

    chart.setData(data);
    chart.addPlugin(siblingPlugin);
    chart.addPlugin(plugin);

    expect(attachedContext?.getData()).toBe(chart.getData());
    expect(attachedContext?.getOptions()).toBe(chart.getOptions());
    expect(attachedContext?.hostElement).toBe(container);
    expect(attachedContext?.getCanvasContext("drawings")).toBe(
      getChartContext(chart, "drawings")
    );
    expect(attachedContext?.getLogicalCanvas("drawings")).toEqual({
      width: Number.parseFloat(
        getChartContext(chart, "drawings").canvas.style.width
      ),
      height: Number.parseFloat(
        getChartContext(chart, "drawings").canvas.style.height
      )
    });
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

  it("scopes context subscriptions to the plugin attachment", () => {
    const { chart } = createChart();
    const eventListener = vi.fn();
    const renderHook = vi.fn();
    let stopListening: (() => void) | undefined;
    const eventSource = new EventSourcePlugin();
    const plugin: ChartPlugin = {
      key: "scoped-subscriptions",
      attach: (ctx) => {
        stopListening = ctx.on("drawing-select", eventListener);
        ctx.onRenderStage("drawings", renderHook);
      }
    };

    chart.addPlugin(eventSource);
    chart.addPlugin(plugin);
    eventSource.emit("drawing-select", {});
    requestChartRedraw(chart, "drawings", true);

    expect(eventListener).toHaveBeenCalledOnce();
    expect(renderHook).toHaveBeenCalledOnce();

    stopListening?.();
    eventSource.emit("drawing-select", {});
    expect(eventListener).toHaveBeenCalledOnce();

    chart.removePlugin(plugin);
    requestChartRedraw(chart, "drawings", true);
    expect(renderHook).toHaveBeenCalledOnce();
  });

  it("releases attachment resources when detach throws", () => {
    const { chart } = createChart();
    const indicator = new ThrowingDetachIndicator();
    const eventListener = vi.fn();
    const eventSource = new EventSourcePlugin();
    const plugin: ChartPlugin = {
      key: "throwing-detach",
      attach: (ctx) => {
        ctx.on("drawing-select", eventListener);
      },
      detach: () => {
        throw new Error("plugin detach failed");
      }
    };

    chart.addIndicator(indicator);
    chart.addPlugin(eventSource);
    chart.addPlugin(plugin);

    expect(() => chart.removeIndicator(indicator)).toThrow(
      "indicator detach failed"
    );
    expect(() => chart.removePlugin(plugin)).toThrow("plugin detach failed");
    expect(chart.getIndicators()).toEqual([]);
    expect(chart.getPlugins()).toEqual([eventSource]);

    eventSource.emit("drawing-select", {});
    expect(eventListener).not.toHaveBeenCalled();

    indicator.shouldThrow = false;
    chart.addIndicator(indicator);
    expect(chart.removeIndicator(indicator)).toBe(true);
  });

  it("cleans scoped subscriptions when plugin attachment fails", () => {
    const { chart } = createChart();
    const eventListener = vi.fn();
    const renderHook = vi.fn();
    const eventSource = new EventSourcePlugin();
    const plugin: ChartPlugin = {
      key: "failed-subscriptions",
      attach: (ctx) => {
        ctx.on("drawing-select", eventListener);
        ctx.onRenderStage("drawings", renderHook);
        throw new Error("attach failed");
      }
    };

    chart.addPlugin(eventSource);
    expect(() => chart.addPlugin(plugin)).toThrow("attach failed");

    eventSource.emit("drawing-select", {});
    requestChartRedraw(chart, "drawings", true);
    expect(eventListener).not.toHaveBeenCalled();
    expect(renderHook).not.toHaveBeenCalled();
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
    chart.setData(data);
    chart.addPlugin(plugin);
    const onCrosshairChange = vi.fn();
    chart.on("crosshair-change", onCrosshairChange);

    const state = attachedContext?.setCrosshair({
      time: data[1].time + 10_000
    });

    expect(state).toEqual(
      expect.objectContaining({
        time: data[1].time,
        dataPoint: data[1],
        paneId: chart.getMainPane().id
      })
    );
    expect(chart.getCrosshairState()).toBe(state);
    expect(onCrosshairChange).toHaveBeenCalledWith(state);
    expect(chart.getCrosshairState()?.y).toBeGreaterThan(0);

    attachedContext?.clearCrosshair();

    expect(chart.getCrosshairState()).toBeUndefined();
  });

  it("detaches indicator label listeners when indicators are removed", () => {
    const { chart, data } = createChart();
    chart.setData(data);
    const indicator = new DetachProbeIndicator();
    const onIndicatorRemove = vi.fn();
    chart.on("indicator-remove", onIndicatorRemove);

    for (let i = 1; i <= 3; i++) {
      chart.addIndicator(indicator);
      const removeButton = indicator
        .getLabelContainer()
        .querySelector('[data-id="remove"]') as HTMLElement;

      chart.removeIndicator(indicator);
      expect(onIndicatorRemove).toHaveBeenCalledOnce();
      onIndicatorRemove.mockClear();
      removeButton.click();

      expect(indicator.detachCalls).toBe(i);
      expect(onIndicatorRemove).not.toHaveBeenCalled();
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
    const canvas = getChartContext(chart, "crosshair").canvas;
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 360,
        clientY: 120,
        bubbles: true
      })
    );
    const finalCrosshair = chart.getCrosshairState();

    chart.dispose();
    chart.dispose();
    charts.pop();

    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: 360,
        clientY: 120,
        bubbles: true
      })
    );

    expect(indicator.detachCalls).toBe(1);
    expect(plugin.detach).toHaveBeenCalledOnce();
    expect(chart.getCrosshairState()).toEqual(finalCrosshair);
    expect(() => chart.addIndicator(new DetachProbeIndicator())).toThrow(
      "Cannot add an indicator to a disposed chart."
    );
    expect(() => chart.addPlugin(plugin)).toThrow(
      "Cannot add a plugin to a disposed chart."
    );
    expect(() => chart.setData(data)).toThrow(
      "Cannot set data on a disposed chart."
    );
    expect(() => chart.updateData(data[0])).toThrow(
      "Cannot update data on a disposed chart."
    );
    expect(() => chart.updateOptions({ maxZoom: 20 })).toThrow(
      "Cannot update options on a disposed chart."
    );
  });

  it("disposes chart-owned resources in ownership order", () => {
    const { chart } = createChart();
    const internals = chart as unknown as {
      interactionController: { dispose(): void };
      renderer: { stop(): void; dispose(): void };
      extensionHost: { dispose(): void };
      paneLayout: { dispose(): void };
      events: { removeAllListeners(): void };
      overlay: { destroy(): void };
      container: HTMLElement;
    };
    const order: string[] = [];
    const resources: Array<[Record<string, () => void>, string, string]> = [
      [internals.interactionController, "dispose", "interaction"],
      [internals.renderer, "stop", "renderer-stop"],
      [internals.extensionHost, "dispose", "extensions"],
      [internals.paneLayout, "dispose", "panes"],
      [internals.events, "removeAllListeners", "events"],
      [internals.renderer, "dispose", "renderer-dispose"],
      [internals.overlay, "destroy", "overlay"],
      [
        internals.container as unknown as Record<string, () => void>,
        "remove",
        "container"
      ]
    ];
    for (const [resource, method, name] of resources) {
      const original = resource[method].bind(resource);
      let recorded = false;
      vi.spyOn(resource, method).mockImplementation(() => {
        if (!recorded) {
          order.push(name);
          recorded = true;
        }
        original();
      });
    }

    chart.dispose();
    charts.pop();

    expect(order).toEqual([
      "interaction",
      "renderer-stop",
      "extensions",
      "panes",
      "events",
      "renderer-dispose",
      "overlay",
      "container"
    ]);
  });

  it("keeps final chart state readable during detach and finishes cleanup after detach throws", () => {
    const { chart, container } = createChart();
    const events = (
      chart as unknown as {
        events: {
          listenerCount(event?: keyof ChartEventMap): number;
        };
      }
    ).events;
    const canvas = getChartContext(chart, "crosshair").canvas;
    const finalState: Array<{
      canvasConnected: boolean;
      listenerCount: number;
      pluginCount: number;
    }> = [];
    const plugin: ChartPlugin = {
      key: "throwing-dispose-probe",
      attach: vi.fn(),
      detach: () => {
        finalState.push({
          canvasConnected: canvas.isConnected,
          listenerCount: events.listenerCount("click"),
          pluginCount: chart.getPlugins().length
        });
        throw new Error("dispose detach failed");
      }
    };

    chart.addPlugin(plugin);
    chart.on("click", vi.fn());

    expect(() => chart.dispose()).toThrow("dispose detach failed");
    charts.pop();

    expect(finalState).toEqual([
      { canvasConnected: true, listenerCount: 1, pluginCount: 1 }
    ]);
    expect(events.listenerCount()).toBe(0);
    expect(canvas.isConnected).toBe(false);
    expect(container.querySelector(".financial-charts")).toBeNull();
    expect(() => chart.dispose()).not.toThrow();
  });
});
