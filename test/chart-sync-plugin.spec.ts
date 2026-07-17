import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData, TimeRange } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import {
  Drawing,
  DrawingManager,
  TrendLine,
  type DrawingJSON,
  type DrawingManagerOptions,
  type DrawingOptions
} from "../src/drawings";
import type { IndicatorResolver } from "../src/indicators/indicator";
import { TestIndicator } from "./fixtures/test-indicator";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import type { ChartPlugin } from "../src/plugin/chart-plugin";
import {
  ChartSyncPlugin,
  type ChartSyncCrosshairSnapshot,
  type ChartSyncPostMessageOptions
} from "../src/plugins";

const charts: FinancialChart[] = [];
const syncGroups = new Set<string>();
let groupId = 0;

class CustomMovingAverageIndicator extends MovingAverageIndicator {
  static ID = "custom-moving-average";
}

interface CustomDrawingData {
  readonly metadata: {
    readonly label: string;
    readonly tags: readonly string[];
  };
}

class CustomDataDrawing extends Drawing {
  static readonly type = "custom-data";
  readonly type = CustomDataDrawing.type;

  private readonly metadata: CustomDrawingData["metadata"];

  constructor(
    options: DrawingOptions & { metadata: CustomDrawingData["metadata"] }
  ) {
    super(options);
    this.metadata = {
      label: options.metadata.label,
      tags: [...options.metadata.tags]
    };
  }

  static fromJSON(json: DrawingJSON) {
    const data = json.data as CustomDrawingData | undefined;
    if (!data) {
      throw new Error("Custom drawing metadata is required.");
    }

    return new CustomDataDrawing({
      anchors: json.anchors,
      id: json.id,
      metadata: data.metadata,
      paneId: json.paneId
    });
  }

  draw() {}

  hitTest() {
    return false;
  }

  protected getDataJSON(): CustomDrawingData {
    return {
      metadata: {
        label: this.metadata.label,
        tags: [...this.metadata.tags]
      }
    };
  }
}

const indicatorResolver: IndicatorResolver = ({ typeId }) =>
  typeId === CustomMovingAverageIndicator.ID
    ? new CustomMovingAverageIndicator()
    : typeId === TestIndicator.ID
      ? new TestIndicator()
      : undefined;

interface ProbeSyncPayload {
  value: string;
}

interface ChartSyncInternals {
  storeVisibleRange(range: TimeRange): void;
  applyVisibleRange(range: TimeRange): void;
  storeCrosshair(snapshot?: ChartSyncCrosshairSnapshot): void;
  applyCrosshair(snapshot?: ChartSyncCrosshairSnapshot): void;
  flushPendingSync(): void;
  applyDrawing(json: DrawingJSON): void;
  applyDrawingDelete(id: string): void;
  applyDrawingSelection(id?: string): void;
  onDrawingFinished(): void;
}

class SyncMessageProbePlugin implements ChartPlugin {
  readonly received: Array<{
    group: string;
    payload: ProbeSyncPayload;
    sourcePlugin: ChartSyncPlugin;
  }> = [];

  private sync?: ChartSyncPlugin;
  private unsubscribe?: () => void;

  constructor(readonly key: string) {}

  attach(ctx: Parameters<ChartPlugin["attach"]>[0]): void {
    const sync = ctx.getPlugin<ChartSyncPlugin>("chart-sync");
    if (!sync) {
      throw new Error("Expected ChartSyncPlugin to be available.");
    }

    this.sync = sync;
    this.unsubscribe = sync.onMessage<ProbeSyncPayload>(
      "probe:update",
      (message) => {
        this.received.push({
          group: message.source.group,
          payload: message.payload,
          sourcePlugin: message.source.plugin
        });
      }
    );
  }

  send(payload: ProbeSyncPayload, options?: ChartSyncPostMessageOptions): void {
    this.sync?.postMessage("probe:update", payload, options);
  }

  detach(): void {
    this.unsubscribe?.();
  }
}

afterEach(() => {
  while (charts.length > 0) {
    charts.pop()?.dispose();
  }
  for (const group of syncGroups) {
    ChartSyncPlugin.clearGroup(group);
  }
  syncGroups.clear();
  document.body.innerHTML = "";
});

function createData(): ChartData[] {
  const start = Date.UTC(2024, 0, 1, 9);

  return [
    { time: start, close: 10 },
    { time: start + 60_000, close: 12 },
    { time: start + 120_000, close: 14 },
    { time: start + 180_000, close: 16 }
  ];
}

function createSyncedChart(
  group: string,
  drawingManagerOptions: DrawingManagerOptions = {},
  height = 400,
  beforeSync?: (chart: FinancialChart) => void
) {
  const data = createData();
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = `${height}px`;
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
  const drawingManager = new DrawingManager(drawingManagerOptions);
  const syncPlugin = new ChartSyncPlugin({
    group,
    drawingManager,
    indicatorResolver
  });
  chart.setData(data);
  beforeSync?.(chart);
  chart.addPlugin(drawingManager);
  chart.addPlugin(syncPlugin);
  charts.push(chart);

  return { chart, container, data, drawingManager, syncPlugin };
}

function createSyncedChartWithDeferredData(group: string) {
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
  const drawingManager = new DrawingManager();
  const syncPlugin = new ChartSyncPlugin({
    group,
    drawingManager,
    indicatorResolver
  });
  chart.addPlugin(drawingManager);
  chart.addPlugin(syncPlugin);
  charts.push(chart);

  return { chart, data, drawingManager, syncPlugin };
}

function createDeferredChartWithSync(
  group: string,
  syncOptions: ConstructorParameters<typeof ChartSyncPlugin>[0] = {}
) {
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
  const drawingManager = new DrawingManager();
  const syncPlugin = new ChartSyncPlugin({
    indicatorResolver,
    ...syncOptions,
    group,
    drawingManager
  });
  chart.addPlugin(drawingManager);
  chart.addPlugin(syncPlugin);
  charts.push(chart);

  return { chart, data, drawingManager, syncPlugin };
}

function createGroup() {
  groupId += 1;
  const group = `sync-test-${groupId}`;
  syncGroups.add(group);
  return group;
}

function nextAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function getCustomIndicator(chart: FinancialChart, instanceId: string) {
  return chart.getIndicatorById(instanceId) as
    | CustomMovingAverageIndicator
    | undefined;
}

function getFirstCustomIndicator(chart: FinancialChart) {
  return chart.getIndicators()[0] as CustomMovingAverageIndicator | undefined;
}

describe("ChartSyncPlugin", () => {
  it("clears retained state for an empty sync group", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    source.chart.setVisibleTimeRange({
      start: source.data[1].time,
      end: source.data[2].time + 60_000
    });
    const retainedRange = source.chart.getVisibleTimeRange();
    source.chart.dispose();
    charts.splice(charts.indexOf(source.chart), 1);

    ChartSyncPlugin.clearGroup(group);

    const target = createSyncedChartWithDeferredData(group);
    target.chart.setData(target.data);

    expect(target.chart.getVisibleTimeRange()).not.toEqual(
      retainedRange
    );
  });

  it("syncs visible ranges by time", async () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);

    source.chart.setVisibleTimeRange({
      start: source.data[1].time,
      end: source.data[2].time + 60_000
    });
    await nextAnimationFrame();

    expect(target.chart.getVisibleTimeRange()).toEqual(
      source.chart.getVisibleTimeRange()
    );
  });

  it("restores initial and ongoing sync after reattachment", async () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);

    target.chart.removePlugin(target.syncPlugin);
    source.chart.setVisibleTimeRange({
      start: source.data[2].time,
      end: source.data[3].time + 60_000
    });
    await nextAnimationFrame();
    target.chart.addPlugin(target.syncPlugin);

    expect(target.chart.getVisibleTimeRange()).toEqual(
      source.chart.getVisibleTimeRange()
    );

    target.chart.setVisibleTimeRange({
      start: target.data[0].time,
      end: target.data[1].time + 60_000
    });
    await nextAnimationFrame();

    expect(source.chart.getVisibleTimeRange()).toEqual(
      target.chart.getVisibleTimeRange()
    );
  });

  it("does not move peers when initial sync clamps to shorter data", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    source.chart.setVisibleTimeRange({
      start: source.data[2].time,
      end: source.data[3].time + 60_000
    });
    const sourceRange = source.chart.getVisibleTimeRange();

    const target = createDeferredChartWithSync(group);
    target.chart.setData(target.data.slice(0, 2));

    expect(target.chart.getVisibleTimeRange()).not.toEqual(sourceRange);
    expect(source.chart.getVisibleTimeRange()).toEqual(sourceRange);
  });

  it("syncs pane height ratios across different chart sizes", async () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group, {}, 770, (chart) => {
      const placeholder = new TestIndicator(null, {
        instanceId: "consumed-pane-id"
      });
      chart.addIndicator(placeholder);
      chart.removeIndicator(placeholder);
    });
    source.chart.addIndicator(
      new TestIndicator(null, { instanceId: "ratio-pane" })
    );

    const [mainPane, indicatorPane] = source.chart.getPanes();
    source.chart.setPaneHeights({
      [mainPane.id]: 222,
      [indicatorPane.id]: 148
    });
    await nextAnimationFrame();
    expect(target.chart.getPanes().map(({ height }) => height)).toEqual([
      444, 296
    ]);

    const divider = source.container.querySelector(
      '[data-id="pane-divider"]'
    ) as HTMLElement;
    divider.dispatchEvent(
      new MouseEvent("pointerdown", {
        bubbles: true,
        clientY: 222
      })
    );
    window.dispatchEvent(
      new MouseEvent("pointermove", {
        bubbles: true,
        clientY: 252
      })
    );
    window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    await nextAnimationFrame();

    expect(source.chart.getPanes().map(({ height }) => height)).toEqual([
      252, 118
    ]);
    expect(target.chart.getPanes().map(({ height }) => height)).toEqual([
      504, 236
    ]);
    expect(target.chart.getPanes()[1].id).not.toBe(
      source.chart.getPanes()[1].id
    );
    expect(
      target.chart
        .toJSON()
        .panes.map(({ heightRatio, indicatorInstanceId }) => ({
          heightRatio,
          indicatorInstanceId
        }))
    ).toEqual(
      source.chart
        .toJSON()
        .panes.map(({ heightRatio, indicatorInstanceId }) => ({
          heightRatio,
          indicatorInstanceId
        }))
    );

    const late = createSyncedChart(group, {}, 770);
    expect(late.chart.getPanes().map(({ height }) => height)).toEqual([
      504, 236
    ]);
  });

  it("shares one scalar snapshot between storage and peers", async () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const firstTarget = createSyncedChart(group);
    const secondTarget = createSyncedChart(group);
    const sourceSync = source.syncPlugin as unknown as ChartSyncInternals;
    const targetSyncs = [firstTarget, secondTarget].map(
      ({ syncPlugin }) => syncPlugin as unknown as ChartSyncInternals
    );
    let storedRange: TimeRange | undefined;
    let storedCrosshair: ChartSyncCrosshairSnapshot | undefined;
    const appliedRanges: TimeRange[] = [];
    const appliedCrosshairs: ChartSyncCrosshairSnapshot[] = [];
    const storeVisibleRange = sourceSync.storeVisibleRange.bind(sourceSync);
    const storeCrosshair = sourceSync.storeCrosshair.bind(sourceSync);

    sourceSync.storeVisibleRange = (range) => {
      storedRange = range;
      storeVisibleRange(range);
    };
    sourceSync.storeCrosshair = (snapshot) => {
      storedCrosshair = snapshot;
      storeCrosshair(snapshot);
    };
    for (const targetSync of targetSyncs) {
      const applyVisibleRange = targetSync.applyVisibleRange.bind(targetSync);
      const applyCrosshair = targetSync.applyCrosshair.bind(targetSync);
      targetSync.applyVisibleRange = (range) => {
        appliedRanges.push(range);
        applyVisibleRange(range);
      };
      targetSync.applyCrosshair = (snapshot) => {
        if (snapshot) appliedCrosshairs.push(snapshot);
        applyCrosshair(snapshot);
      };
    }

    source.chart.setVisibleLogicalRange({ from: 0.25, to: 2.25 });
    source.chart.setCrosshair({
      time: source.data[1].time,
      price: source.data[1].close ?? undefined
    });
    await nextAnimationFrame();

    expect(appliedRanges).toHaveLength(2);
    expect(appliedRanges[0]).toBe(storedRange);
    expect(appliedRanges[1]).toBe(storedRange);
    expect(appliedCrosshairs).toHaveLength(2);
    expect(appliedCrosshairs[0]).toBe(storedCrosshair);
    expect(appliedCrosshairs[1]).toBe(storedCrosshair);
  });

  it("coalesces range and drawing changes to their final frame values without echo", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    const sourceSync = source.syncPlugin as unknown as ChartSyncInternals;
    const targetSync = target.syncPlugin as unknown as ChartSyncInternals;
    let drawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 1, price: 12 }
      ],
      id: "coalesced-drawing",
      paneId: source.chart.getMainPane().id
    });
    const selected = new TrendLine({
      anchors: [
        { index: 2, price: 14 },
        { index: 3, price: 16 }
      ],
      id: "selected-drawing",
      paneId: source.chart.getMainPane().id
    });
    source.drawingManager.addDrawing(drawing, { emit: true });
    source.drawingManager.addDrawing(selected, { emit: true });

    const applyRange = vi.spyOn(targetSync, "applyVisibleRange");
    const applyDrawing = vi.spyOn(targetSync, "applyDrawing");
    const echoRange = vi.spyOn(sourceSync, "applyVisibleRange");
    const echoDrawing = vi.spyOn(sourceSync, "applyDrawing");
    source.chart.setVisibleLogicalRange({ from: 0.1, to: 2.1 });
    source.chart.setVisibleLogicalRange({ from: 0.4, to: 2.4 });
    drawing.setAnchors([
      { index: 0, price: 11 },
      { index: 2, price: 15 }
    ]);
    drawing = source.drawingManager.upsertDrawing(drawing.toJSON(), {
      emit: true
    }) as TrendLine;
    drawing.setAnchors([
      { index: 1, price: 13 },
      { index: 3, price: 17 }
    ]);
    drawing = source.drawingManager.upsertDrawing(drawing.toJSON(), {
      emit: true
    }) as TrendLine;

    sourceSync.flushPendingSync();

    expect(applyRange).toHaveBeenCalledOnce();
    expect(applyDrawing).toHaveBeenCalledOnce();
    expect(applyDrawing).toHaveBeenCalledWith(drawing.toJSON());
    expect(target.chart.getVisibleLogicalRange()).toEqual(
      source.chart.getVisibleLogicalRange()
    );
    expect(
      target.drawingManager.getDrawingById(drawing.id)?.getAnchors()
    ).toEqual(drawing.getAnchors());
    expect(echoRange).not.toHaveBeenCalled();
    expect(echoDrawing).not.toHaveBeenCalled();
  });

  it("drops a pending drawing change before synchronizing its deletion", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    const targetSync = target.syncPlugin as unknown as ChartSyncInternals;
    let drawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 1, price: 12 }
      ],
      id: "deleted-before-flush",
      paneId: source.chart.getMainPane().id
    });
    const selected = new TrendLine({
      anchors: [
        { index: 2, price: 14 },
        { index: 3, price: 16 }
      ],
      id: "delete-selected-drawing",
      paneId: source.chart.getMainPane().id
    });
    source.drawingManager.addDrawing(drawing, { emit: true });
    source.drawingManager.addDrawing(selected, { emit: true });
    const applyDrawing = vi.spyOn(targetSync, "applyDrawing");
    const applyDelete = vi.spyOn(targetSync, "applyDrawingDelete");

    drawing.setAnchors([
      { index: 1, price: 11 },
      { index: 2, price: 15 }
    ]);
    drawing = source.drawingManager.upsertDrawing(drawing.toJSON(), {
      emit: true
    }) as TrendLine;
    source.drawingManager.deleteDrawing(drawing);

    expect(applyDrawing).not.toHaveBeenCalled();
    expect(applyDelete).toHaveBeenCalledOnce();
    expect(target.drawingManager.getDrawingById(drawing.id)).toBeUndefined();
  });

  it("flushes a pending drawing change before selection and finish", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    const sourceSync = source.syncPlugin as unknown as ChartSyncInternals;
    const targetSync = target.syncPlugin as unknown as ChartSyncInternals;
    let drawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 1, price: 12 }
      ],
      id: "ordered-drawing",
      paneId: source.chart.getMainPane().id
    });
    const selected = new TrendLine({
      anchors: [
        { index: 2, price: 14 },
        { index: 3, price: 16 }
      ],
      id: "ordered-selected-drawing",
      paneId: source.chart.getMainPane().id
    });
    source.drawingManager.addDrawing(drawing, { emit: true });
    source.drawingManager.addDrawing(selected, { emit: true });
    const order: string[] = [];
    const applyDrawing = targetSync.applyDrawing.bind(targetSync);
    targetSync.applyDrawing = (json) => {
      order.push("change");
      applyDrawing(json);
    };
    const applySelection = targetSync.applyDrawingSelection.bind(targetSync);
    targetSync.applyDrawingSelection = (id) => {
      order.push("select");
      applySelection(id);
    };

    drawing.setAnchors([
      { index: 1, price: 11 },
      { index: 2, price: 15 }
    ]);
    drawing = source.drawingManager.upsertDrawing(drawing.toJSON(), {
      emit: true
    }) as TrendLine;
    source.drawingManager.selectDrawing(drawing);

    expect(order).toEqual(["change", "select"]);

    source.drawingManager.selectDrawing(selected);
    order.length = 0;
    drawing.setAnchors([
      { index: 1, price: 12 },
      { index: 3, price: 16 }
    ]);
    source.drawingManager.upsertDrawing(drawing.toJSON(), { emit: true });
    sourceSync.onDrawingFinished();

    expect(order).toEqual(["change"]);
  });

  it("flushes pending state on detach and resets scheduling for reattachment", async () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    const cancelAnimationFrame = vi.spyOn(
      globalThis,
      "cancelAnimationFrame"
    );

    source.chart.setVisibleLogicalRange({ from: 0.3, to: 2.3 });
    source.chart.removePlugin(source.syncPlugin);

    expect(target.chart.getVisibleLogicalRange()).toEqual(
      source.chart.getVisibleLogicalRange()
    );
    expect(cancelAnimationFrame).toHaveBeenCalled();

    source.chart.addPlugin(source.syncPlugin);
    target.chart.setVisibleLogicalRange({ from: 0.6, to: 2.6 });
    await nextAnimationFrame();

    expect(source.chart.getVisibleLogicalRange()).toEqual(
      target.chart.getVisibleLogicalRange()
    );
  });

  it("preserves fractional visible windows while panning", async () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);

    source.chart.setVisibleLogicalRange({ from: 0.35, to: 2.35 });
    await nextAnimationFrame();

    const sourceLogical = source.chart.getVisibleLogicalRange();
    const targetLogical = target.chart.getVisibleLogicalRange();
    const sourceWindow = source.chart.getVisibleTimeWindow();
    const targetWindow = target.chart.getVisibleTimeWindow();

    expect(targetLogical.from).toBeCloseTo(sourceLogical.from, 10);
    expect(targetLogical.to).toBeCloseTo(sourceLogical.to, 10);
    expect(targetLogical.to - targetLogical.from).toBeCloseTo(
      sourceLogical.to - sourceLogical.from,
      10
    );
    expect(targetWindow.start).toBeCloseTo(sourceWindow.start, 5);
    expect(targetWindow.end).toBeCloseTo(sourceWindow.end, 5);
  });

  it("applies initial state when a freshly mounted chart receives data after sync attach", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const sourceDrawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 2, price: 14 }
      ],
      id: "deferred-data-trend",
      paneId: source.chart.getMainPane().id
    });
    const sourceIndicator = new CustomMovingAverageIndicator(null, {
      instanceId: "deferred-data-sma",
      names: { default: "Deferred Data SMA" },
      period: 7,
      source: "close"
    });

    source.chart.setVisibleTimeRange({
      start: source.data[1].time,
      end: source.data[2].time + 60_000
    });
    source.drawingManager.addDrawing(sourceDrawing, { emit: true });
    source.chart.addIndicator(sourceIndicator);
    source.chart.setCrosshair({
      time: source.data[2].time,
      price: source.data[2].close ?? undefined
    });

    const target = createSyncedChartWithDeferredData(group);

    expect(target.chart.getData()).toEqual([]);
    expect(target.drawingManager.getDrawings()).toEqual([]);

    target.chart.setData(target.data);

    expect(target.chart.getVisibleTimeRange()).toEqual(
      source.chart.getVisibleTimeRange()
    );
    expect(target.drawingManager.getDrawings()[0]?.id).toBe(
      "deferred-data-trend"
    );
    expect(target.chart.getIndicators()[0]).toBeInstanceOf(
      CustomMovingAverageIndicator
    );
    expect(getFirstCustomIndicator(target.chart)?.getOptions().period).toBe(7);
    expect(target.chart.getCrosshairState()?.time).toBe(source.data[2].time);
  });

  it("retains group state when every chart unmounts before a fresh chart mounts", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const sourceDrawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 2, price: 14 }
      ],
      id: "retained-trend",
      paneId: source.chart.getMainPane().id
    });
    const sourceIndicator = new CustomMovingAverageIndicator(null, {
      instanceId: "retained-sma",
      names: { default: "Retained SMA" },
      period: 13,
      source: "close"
    });

    source.chart.setVisibleTimeRange({
      start: source.data[1].time,
      end: source.data[2].time + 60_000
    });
    source.drawingManager.addDrawing(sourceDrawing, { emit: true });
    source.chart.addIndicator(sourceIndicator);
    source.chart.setCrosshair({
      time: source.data[2].time,
      price: source.data[2].close ?? undefined
    });

    const retainedVisibleRange = source.chart.getVisibleTimeRange();
    source.chart.dispose();
    charts.splice(charts.indexOf(source.chart), 1);

    const target = createSyncedChartWithDeferredData(group);
    target.chart.setData(target.data);

    expect(target.chart.getVisibleTimeRange()).toEqual(retainedVisibleRange);
    expect(target.drawingManager.getDrawings()[0]?.id).toBe("retained-trend");
    expect(target.chart.getIndicators()[0]).toBeInstanceOf(
      CustomMovingAverageIndicator
    );
    expect(getFirstCustomIndicator(target.chart)?.getOptions().period).toBe(
      13
    );
    expect(target.chart.getCrosshairState()?.time).toBe(source.data[2].time);
  });

  it("does not defer initial sync when initialSync is disabled", () => {
    const group = createGroup();
    const source = createSyncedChart(group);

    source.chart.addIndicator(
      new CustomMovingAverageIndicator(null, {
        instanceId: "initial-sync-disabled-sma",
        names: { default: "Disabled Initial Sync SMA" },
        period: 11,
        source: "close"
      })
    );

    const target = createDeferredChartWithSync(group, { initialSync: false });
    target.chart.setData(target.data);

    expect(target.chart.getIndicators()).toEqual([]);
  });

  it("syncs crosshair changes and clears", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);

    source.chart.setCrosshair({
      time: source.data[1].time,
      price: source.data[1].close ?? undefined
    });

    expect(target.chart.getCrosshairState()?.time).toBe(source.data[1].time);
    expect(target.chart.getCrosshairState()?.dataPoint.time).toBe(
      source.data[1].time
    );

    source.chart.clearCrosshair();

    expect(target.chart.getCrosshairState()).toBeUndefined();
  });

  it("syncs drawing create, change, selection, and delete", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    let drawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 2, price: 14 }
      ],
      id: "trend-sync",
      paneId: source.chart.getMainPane().id
    });

    source.drawingManager.addDrawing(drawing, { emit: true });

    expect(target.drawingManager.getDrawings()[0]?.id).toBe("trend-sync");
    expect(target.drawingManager.getSelectedDrawing()?.id).toBe("trend-sync");

    drawing.setAnchors([
      { index: 1, price: 11 },
      { index: 3, price: 16 }
    ]);
    drawing = source.drawingManager.upsertDrawing(drawing.toJSON(), {
      emit: true
    }) as TrendLine;

    expect(target.drawingManager.getDrawings()[0]?.getAnchors()).toEqual(
      drawing.getAnchors()
    );

    source.drawingManager.selectDrawing(drawing, { force: true });

    expect(target.drawingManager.getSelectedDrawing()?.id).toBe("trend-sync");

    source.drawingManager.deleteDrawing(drawing);

    expect(target.drawingManager.getDrawings()).toEqual([]);
  });

  it("updates retained drawing state without serializing unrelated drawings", async () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    let first = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 1, price: 12 }
      ],
      id: "incremental-first",
      paneId: source.chart.getMainPane().id
    });
    const second = new TrendLine({
      anchors: [
        { index: 2, price: 14 },
        { index: 3, price: 16 }
      ],
      id: "incremental-second",
      paneId: source.chart.getMainPane().id
    });

    source.drawingManager.addDrawing(first, { emit: true });
    source.drawingManager.addDrawing(second, { emit: true });

    const serializeSecond = vi.spyOn(second, "toJSON");
    first.setAnchors([
      { index: 0, price: 11 },
      { index: 2, price: 15 }
    ]);
    first = source.drawingManager.upsertDrawing(first.toJSON(), {
      emit: true
    }) as TrendLine;
    await nextAnimationFrame();

    expect(serializeSecond).not.toHaveBeenCalled();
    expect(
      target.drawingManager
        .getDrawings()
        .find(({ id }) => id === first.id)
        ?.getAnchors()
    ).toEqual(first.getAnchors());

    source.drawingManager.selectDrawing(first);
    expect(serializeSecond).not.toHaveBeenCalled();
    serializeSecond.mockRestore();

    const serializeFirst = vi.spyOn(first, "toJSON");
    source.drawingManager.deleteDrawing(second);

    expect(serializeFirst).not.toHaveBeenCalled();
    expect(target.drawingManager.getDrawings().map(({ id }) => id)).toEqual([
      first.id
    ]);

    const late = createSyncedChart(group);
    expect(serializeFirst).not.toHaveBeenCalled();
    expect(late.drawingManager.getDrawings().map(({ id }) => id)).toEqual([
      first.id
    ]);
    expect(late.drawingManager.getDrawings()[0]?.getAnchors()).toEqual(
      first.getAnchors()
    );
    expect(late.drawingManager.getSelectedDrawing()?.id).toBe(first.id);
  });

  it("preserves custom drawing data for live and late synchronization", () => {
    const group = createGroup();
    const drawingManagerOptions: DrawingManagerOptions = {
      drawingDeserializers: {
        [CustomDataDrawing.type]: CustomDataDrawing.fromJSON
      }
    };
    const source = createSyncedChart(group, drawingManagerOptions);
    const target = createSyncedChart(group, drawingManagerOptions);
    const drawing = new CustomDataDrawing({
      anchors: [{ index: 1, price: 12 }],
      id: "custom-data-drawing",
      metadata: {
        label: "Earnings",
        tags: ["event", "quarterly"]
      },
      paneId: source.chart.getMainPane().id
    });

    source.drawingManager.addDrawing(drawing, { emit: true });

    expect(target.drawingManager.getDrawings()[0]?.toJSON().data).toEqual(
      drawing.toJSON().data
    );

    const late = createSyncedChart(group, drawingManagerOptions);
    expect(late.drawingManager.getDrawings()[0]?.toJSON().data).toEqual(
      drawing.toJSON().data
    );
  });

  it("syncs multiple indicators of the same type by instance ID", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    const targetEvents: string[] = [];
    target.chart.on("indicator-add", ({ indicator }) => {
      targetEvents.push(`add:${indicator.getInstanceId()}`);
    });
    target.chart.on("indicator-change", ({ indicator }) => {
      targetEvents.push(`change:${indicator.getInstanceId()}`);
    });
    target.chart.on("indicator-visibility-changed", ({ indicator }) => {
      targetEvents.push(`visibility:${indicator.getInstanceId()}`);
    });
    target.chart.on("indicator-remove", ({ indicator }) => {
      targetEvents.push(`remove:${indicator.getInstanceId()}`);
    });
    const fast = new CustomMovingAverageIndicator(null, {
      instanceId: "fast-sma",
      names: { default: "Fast SMA" },
      period: 9,
      source: "close"
    });
    const slow = new CustomMovingAverageIndicator(null, {
      instanceId: "slow-sma",
      names: { default: "Slow SMA" },
      period: 21,
      source: "close"
    });
    const serializeFast = vi.spyOn(fast, "toJSON");
    const serializeSlow = vi.spyOn(slow, "toJSON");

    source.chart.addIndicator(fast);
    source.chart.addIndicator(slow);

    expect(serializeFast).toHaveBeenCalledTimes(1);
    expect(serializeSlow).toHaveBeenCalledTimes(1);
    expect(targetEvents).toEqual(["add:fast-sma", "add:slow-sma"]);
    expect(target.chart.getIndicatorById("fast-sma")).toBeInstanceOf(
      CustomMovingAverageIndicator
    );
    expect(getCustomIndicator(target.chart, "fast-sma")?.getOptions().period).toBe(
      9
    );
    expect(getCustomIndicator(target.chart, "slow-sma")?.getOptions().period).toBe(
      21
    );
    expect(
      target.chart.getIndicatorsByType("custom-moving-average")
    ).toHaveLength(2);

    serializeFast.mockClear();
    serializeSlow.mockClear();
    fast.updateOptions({ period: 12 });

    expect(serializeFast).toHaveBeenCalledTimes(1);
    expect(serializeSlow).not.toHaveBeenCalled();
    expect(targetEvents.at(-1)).toBe("change:fast-sma");
    expect(getCustomIndicator(target.chart, "fast-sma")?.getOptions().period).toBe(
      12
    );
    expect(getCustomIndicator(target.chart, "slow-sma")?.getOptions().period).toBe(
      21
    );

    serializeFast.mockClear();
    serializeSlow.mockClear();
    slow.setVisible(false);

    expect(serializeFast).not.toHaveBeenCalled();
    expect(serializeSlow).toHaveBeenCalledTimes(1);
    expect(targetEvents.slice(-2)).toEqual([
      "change:slow-sma",
      "visibility:slow-sma"
    ]);
    expect(
      target.chart.getIndicatorById("slow-sma")?.isIndicatorVisible()
    ).toBe(false);
    expect(
      target.chart.getIndicatorById("fast-sma")?.isIndicatorVisible()
    ).toBe(true);

    serializeFast.mockClear();
    serializeSlow.mockClear();
    source.chart.removeIndicator(fast);

    expect(serializeFast).not.toHaveBeenCalled();
    expect(serializeSlow).not.toHaveBeenCalled();
    expect(targetEvents.at(-1)).toBe("remove:fast-sma");
    expect(target.chart.getIndicatorById("fast-sma")).toBeUndefined();
    expect(target.chart.getIndicatorById("slow-sma")).toBeDefined();

    const late = createSyncedChart(group);

    expect(serializeFast).not.toHaveBeenCalled();
    expect(serializeSlow).not.toHaveBeenCalled();
    expect(late.chart.getIndicatorById("fast-sma")).toBeUndefined();
    expect(late.chart.getIndicatorById("slow-sma")).toBeInstanceOf(
      CustomMovingAverageIndicator
    );
    expect(getCustomIndicator(late.chart, "slow-sma")?.getOptions().period).toBe(
      21
    );
    expect(
      late.chart.getIndicatorById("slow-sma")?.isIndicatorVisible()
    ).toBe(false);
  });

  it("lets third-party plugins exchange custom messages through context lookup", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    const otherGroup = createSyncedChart(createGroup());
    const sourceProbe = new SyncMessageProbePlugin("source-probe");
    const targetProbe = new SyncMessageProbePlugin("target-probe");
    const otherProbe = new SyncMessageProbePlugin("other-probe");

    source.chart.addPlugin(sourceProbe);
    target.chart.addPlugin(targetProbe);
    otherGroup.chart.addPlugin(otherProbe);

    sourceProbe.send({ value: "compare-series:MSFT" });

    expect(sourceProbe.received).toEqual([]);
    expect(targetProbe.received).toEqual([
      {
        group,
        payload: { value: "compare-series:MSFT" },
        sourcePlugin: source.syncPlugin
      }
    ]);
    expect(otherProbe.received).toEqual([]);

    targetProbe.send({ value: "ack" }, { includeSelf: true });

    expect(sourceProbe.received).toEqual([
      {
        group,
        payload: { value: "ack" },
        sourcePlugin: target.syncPlugin
      }
    ]);
    expect(targetProbe.received).toEqual([
      {
        group,
        payload: { value: "compare-series:MSFT" },
        sourcePlugin: source.syncPlugin
      },
      {
        group,
        payload: { value: "ack" },
        sourcePlugin: target.syncPlugin
      }
    ]);
    expect(otherProbe.received).toEqual([]);
  });

  it("does not rebroadcast custom messages posted while handling custom messages", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
    const third = createSyncedChart(group);
    let sourceReceived = 0;
    let targetReceived = 0;
    let thirdReceived = 0;

    source.syncPlugin.onMessage("probe:ping", () => {
      sourceReceived += 1;
    });
    target.syncPlugin.onMessage("probe:ping", () => {
      targetReceived += 1;
      target.syncPlugin.postMessage("probe:ping", { from: "target" });
    });
    third.syncPlugin.onMessage("probe:ping", () => {
      thirdReceived += 1;
    });

    source.syncPlugin.postMessage("probe:ping", { from: "source" });

    expect(sourceReceived).toBe(0);
    expect(targetReceived).toBe(1);
    expect(thirdReceived).toBe(1);
  });
});
