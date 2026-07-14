import { afterEach, describe, expect, it } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartData } from "../src/chart/types";
import { LineController } from "../src/controllers/line-controller";
import { DrawingManager, TrendLine } from "../src/drawings";
import type { IndicatorResolver } from "../src/indicators/indicator";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import type { ChartPlugin } from "../src/plugin/chart-plugin";
import {
  ChartSyncPlugin,
  type ChartSyncPostMessageOptions
} from "../src/plugins";

const charts: FinancialChart[] = [];
let groupId = 0;

const getSyncGroupSize = (
  ChartSyncPlugin as unknown as {
    getGroupSizeForTest(group: string): number;
  }
).getGroupSizeForTest;

class CustomMovingAverageIndicator extends MovingAverageIndicator {
  static ID = "custom-moving-average";
}

const indicatorResolver: IndicatorResolver = ({ typeId }) =>
  typeId === CustomMovingAverageIndicator.ID
    ? new CustomMovingAverageIndicator()
    : undefined;

interface ProbeSyncPayload {
  value: string;
}

class SyncMessageProbePlugin implements ChartPlugin {
  readonly received: Array<{
    group: string;
    payload: ProbeSyncPayload;
    sourceChart: FinancialChart;
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
          sourceChart: message.source.chart
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

function createSyncedChart(group: string) {
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
  const drawingManager = new DrawingManager();
  const syncPlugin = new ChartSyncPlugin({
    group,
    drawingManager,
    indicatorResolver
  });
  chart.setData(data);
  chart.addPlugin(drawingManager);
  chart.addPlugin(syncPlugin);
  charts.push(chart);

  return { chart, data, drawingManager, syncPlugin };
}

function createSyncedChartWithDeferredData(group: string) {
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
  return `sync-test-${groupId}`;
}

describe("ChartSyncPlugin", () => {
  it("cleans up empty sync groups when charts are disposed", () => {
    const group = createGroup();
    const first = createSyncedChart(group);
    const second = createSyncedChart(group);

    expect(getSyncGroupSize(group)).toBe(2);

    first.chart.dispose();
    charts.splice(charts.indexOf(first.chart), 1);

    expect(getSyncGroupSize(group)).toBe(1);

    second.chart.dispose();
    charts.splice(charts.indexOf(second.chart), 1);

    expect(getSyncGroupSize(group)).toBe(0);
  });

  it("syncs visible ranges by time", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);

    source.chart.setVisibleTimeRange({
      start: source.data[1].time,
      end: source.data[2].time + 60_000
    });

    expect(target.chart.getVisibleTimeRange()).toEqual(
      source.chart.getVisibleTimeRange()
    );
  });

  it("preserves fractional visible windows while panning", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);

    source.chart.setVisibleIndexRange({ from: 0.35, to: 2.35 });

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
      paneId: source.chart.getMainPane().getId()
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
    source.drawingManager.addDrawing(sourceDrawing);
    source.chart.emit("drawing-create", { drawing: sourceDrawing });
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
    expect(target.chart.getIndicators()[0]?.getOptions().period).toBe(7);
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
      paneId: source.chart.getMainPane().getId()
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
    source.drawingManager.addDrawing(sourceDrawing);
    source.chart.emit("drawing-create", { drawing: sourceDrawing });
    source.chart.addIndicator(sourceIndicator);
    source.chart.setCrosshair({
      time: source.data[2].time,
      price: source.data[2].close ?? undefined
    });

    const retainedVisibleRange = source.chart.getVisibleTimeRange();
    source.chart.dispose();
    charts.splice(charts.indexOf(source.chart), 1);

    expect(getSyncGroupSize(group)).toBe(0);

    const target = createSyncedChartWithDeferredData(group);
    target.chart.setData(target.data);

    expect(target.chart.getVisibleTimeRange()).toEqual(retainedVisibleRange);
    expect(target.drawingManager.getDrawings()[0]?.id).toBe("retained-trend");
    expect(target.chart.getIndicators()[0]).toBeInstanceOf(
      CustomMovingAverageIndicator
    );
    expect(target.chart.getIndicators()[0]?.getOptions().period).toBe(13);
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
    const drawing = new TrendLine({
      anchors: [
        { index: 0, price: 10 },
        { index: 2, price: 14 }
      ],
      id: "trend-sync",
      paneId: source.chart.getMainPane().getId()
    });

    source.drawingManager.addDrawing(drawing);
    source.chart.emit("drawing-create", { drawing });

    expect(target.drawingManager.getDrawings()[0]?.id).toBe("trend-sync");

    drawing.setAnchors([
      { index: 1, price: 11 },
      { index: 3, price: 16 }
    ]);
    source.chart.emit("drawing-change", { drawing });

    expect(target.drawingManager.getDrawings()[0]?.getAnchors()).toEqual(
      drawing.getAnchors()
    );

    source.drawingManager.selectDrawing(drawing, { force: true });

    expect(target.drawingManager.getSelectedDrawing()?.id).toBe("trend-sync");

    source.drawingManager.deleteDrawing(drawing);

    expect(target.drawingManager.getDrawings()).toEqual([]);
  });

  it("syncs multiple indicators of the same type by instance ID", () => {
    const group = createGroup();
    const source = createSyncedChart(group);
    const target = createSyncedChart(group);
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

    source.chart.addIndicator(fast);
    source.chart.addIndicator(slow);

    expect(target.chart.getIndicatorById("fast-sma")).toBeInstanceOf(
      CustomMovingAverageIndicator
    );
    expect(target.chart.getIndicatorById("fast-sma")?.getOptions().period).toBe(
      9
    );
    expect(target.chart.getIndicatorById("slow-sma")?.getOptions().period).toBe(
      21
    );
    expect(
      target.chart.getIndicatorsByType("custom-moving-average")
    ).toHaveLength(2);

    fast.updateOptions({ period: 12 });

    expect(target.chart.getIndicatorById("fast-sma")?.getOptions().period).toBe(
      12
    );
    expect(target.chart.getIndicatorById("slow-sma")?.getOptions().period).toBe(
      21
    );

    slow.setVisible(false);

    expect(
      target.chart.getIndicatorById("slow-sma")?.isIndicatorVisible()
    ).toBe(false);
    expect(
      target.chart.getIndicatorById("fast-sma")?.isIndicatorVisible()
    ).toBe(true);

    source.chart.removeIndicator(fast);

    expect(target.chart.getIndicatorById("fast-sma")).toBeUndefined();
    expect(target.chart.getIndicatorById("slow-sma")).toBeDefined();
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
        sourceChart: source.chart
      }
    ]);
    expect(otherProbe.received).toEqual([]);

    targetProbe.send({ value: "ack" }, { includeSelf: true });

    expect(sourceProbe.received).toEqual([
      {
        group,
        payload: { value: "ack" },
        sourceChart: target.chart
      }
    ]);
    expect(targetProbe.received).toEqual([
      {
        group,
        payload: { value: "compare-series:MSFT" },
        sourceChart: source.chart
      },
      {
        group,
        payload: { value: "ack" },
        sourceChart: target.chart
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
