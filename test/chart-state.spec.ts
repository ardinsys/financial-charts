import { afterEach, describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/chart/default-financial-chart";
import type { ChartStateContributor } from "../src/chart/financial-chart";
import type { ChartData } from "../src/chart/types";
import { DrawingManager, TrendLine } from "../src/drawings";
import type { IndicatorResolver } from "../src/indicators/indicator";
import { TestIndicator } from "../src/indicators/paneled/test-indicator";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import type { ChartPlugin } from "../src/plugin/chart-plugin";

const charts: FinancialChart[] = [];

function createData(): ChartData[] {
  const start = Date.UTC(2024, 0, 1, 9);
  return Array.from({ length: 8 }, (_, index) => ({
    time: start + index * 60_000,
    close: 10 + index * 2
  }));
}

function createChart({
  data = createData(),
  maxZoom = 10,
  stepSize = 60_000,
  type = "line",
  volume = false,
  height = 400
}: {
  data?: readonly ChartData[];
  maxZoom?: number;
  stepSize?: number;
  type?: "candle" | "line";
  volume?: boolean;
  height?: number;
} = {}) {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = `${height}px`;
  document.body.appendChild(container);

  const allData = createData();
  const chart = new FinancialChart(container, {
    timeRange: {
      start: allData[0].time,
      end: allData.at(-1)!.time + 60_000
    },
    type,
    stepSize,
    maxZoom,
    volume,
    locale: "en-US"
  });
  if (data.length > 0) chart.setData(data);
  charts.push(chart);
  return chart;
}

const indicatorResolver: IndicatorResolver = ({ typeId }) => {
  switch (typeId) {
    case MovingAverageIndicator.ID:
      return new MovingAverageIndicator();
    case TestIndicator.ID:
      return new TestIndicator();
    default:
      return undefined;
  }
};

afterEach(() => {
  vi.restoreAllMocks();
  while (charts.length > 0) charts.pop()?.dispose();
  document.body.innerHTML = "";
});

describe("chart state", () => {
  it("round-trips core options, the precise view, panes, indicators, and drawings", async () => {
    const source = createChart({ maxZoom: 25 });
    const sourceDrawings = new DrawingManager();
    source.addPlugin(sourceDrawings);

    const fast = new MovingAverageIndicator(null, {
      instanceId: "fast-sma",
      period: 9,
      source: "close"
    });
    const slow = new MovingAverageIndicator(null, {
      instanceId: "slow-sma",
      period: 21,
      source: "open"
    });
    const paneled = new TestIndicator(null, { instanceId: "pane-test" });
    slow.setVisible(false);
    source.addIndicator(fast);
    source.addIndicator(slow);
    source.addIndicator(paneled);
    source.setVisibleLogicalRange({ from: 1.25, to: 5.25 });

    const [mainPane, indicatorPane] = source.getPanes();
    source.setPaneHeights({
      [mainPane.id]: 222,
      [indicatorPane.id]: 148
    });
    sourceDrawings.addDrawing(
      new TrendLine({
        anchors: [
          { index: 1, price: 12 },
          { index: 4, price: 18 }
        ],
        id: "pane-trend",
        paneId: indicatorPane.id
      })
    );

    const state = JSON.parse(
      JSON.stringify(source.toJSON({ contributors: [sourceDrawings] }))
    );

    const target = createChart({
      maxZoom: 5,
      stepSize: 120_000,
      type: "candle",
      volume: true,
      height: 770
    });
    const targetDrawings = new DrawingManager();
    target.addPlugin(targetDrawings);
    target.addIndicator(
      new MovingAverageIndicator(null, { instanceId: "old-indicator" })
    );

    const onOptionsChanged = vi.fn();
    const onData = vi.fn();
    const onVisibleRangeChanged = vi.fn();
    const lifecycleProbe: ChartPlugin = {
      key: "state-lifecycle-probe",
      attach: vi.fn(),
      onOptionsChanged,
      onData,
      onVisibleRangeChanged
    };
    target.addPlugin(lifecycleProbe);
    onOptionsChanged.mockClear();
    onData.mockClear();
    onVisibleRangeChanged.mockClear();

    const onOptionsChange = vi.fn();
    const onIndicatorAdd = vi.fn();
    const onIndicatorRemove = vi.fn();
    const onDrawingCreate = vi.fn();
    const onDrawingDelete = vi.fn();
    const onStateRestored = vi.fn();
    target.on("options-change", onOptionsChange);
    target.on("indicator-add", onIndicatorAdd);
    target.on("indicator-remove", onIndicatorRemove);
    target.on("drawing-create", onDrawingCreate);
    target.on("drawing-delete", onDrawingDelete);
    target.on("state-restored", onStateRestored);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const requestAnimationFrame = vi.spyOn(globalThis, "requestAnimationFrame");

    target.restoreState(state, {
      indicatorResolver,
      contributors: [targetDrawings]
    });

    expect(target.toJSON({ contributors: [targetDrawings] })).toEqual(state);
    expect(target.getIndicatorsByType(MovingAverageIndicator.ID)).toHaveLength(
      2
    );
    expect(
      (target.getIndicatorById("fast-sma") as MovingAverageIndicator)
        .getOptions().period
    ).toBe(9);
    expect(
      (target.getIndicatorById("slow-sma") as MovingAverageIndicator)
        .getOptions().period
    ).toBe(21);
    expect(target.getIndicatorById("slow-sma")?.isIndicatorVisible()).toBe(
      false
    );
    expect(
      Object.fromEntries(
        target.getPanes().map(({ id, height }) => [id, height])
      )
    ).toEqual({ 0: 444, 1: 296 });
    expect(targetDrawings.getDrawings()[0]?.getPaneId()).toBe(1);

    expect(onOptionsChange).not.toHaveBeenCalled();
    expect(onIndicatorAdd).not.toHaveBeenCalled();
    expect(onIndicatorRemove).not.toHaveBeenCalled();
    expect(onDrawingCreate).not.toHaveBeenCalled();
    expect(onDrawingDelete).not.toHaveBeenCalled();
    expect(onStateRestored).toHaveBeenCalledOnce();
    expect(onStateRestored).toHaveBeenCalledWith({ state });
    expect(onStateRestored.mock.calls[0][0].state).not.toBe(state);
    expect(onOptionsChanged).toHaveBeenCalledOnce();
    expect(onData).toHaveBeenCalledOnce();
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it("keeps a restored precise view pending until data is available", () => {
    const data = createData();
    const source = createChart({ data });
    source.setVisibleLogicalRange({ from: 1.5, to: 4.5 });
    source.addIndicator(
      new MovingAverageIndicator(null, {
        instanceId: "deferred-sma",
        period: 13
      })
    );
    const state = source.toJSON();

    const target = createChart({ data: [] });
    target.restoreState(state, { indicatorResolver });

    expect(target.toJSON().visibleRange).toEqual(state.visibleRange);
    target.setData(data);
    expect(target.getVisibleTimeWindow().start).toBeCloseTo(
      state.visibleRange.start,
      10
    );
    expect(target.getVisibleTimeWindow().end).toBeCloseTo(
      state.visibleRange.end,
      10
    );
    expect(target.getIndicatorById("deferred-sma")).toBeDefined();
  });

  it("delivers coherent final plugin state when options do not change", () => {
    const source = createChart();
    const target = createChart();
    const onOptionsChanged = vi.fn();
    const onData = vi.fn();
    const onVisibleRangeChanged = vi.fn();
    target.addPlugin({
      key: "unchanged-state-lifecycle-probe",
      attach: vi.fn(),
      onOptionsChanged,
      onData,
      onVisibleRangeChanged
    });
    onOptionsChanged.mockClear();
    onData.mockClear();
    onVisibleRangeChanged.mockClear();

    target.restoreState(source.toJSON());

    expect(onOptionsChanged).toHaveBeenCalledOnce();
    expect(onOptionsChanged).toHaveBeenCalledWith({
      previous: target.getOptions(),
      current: target.getOptions(),
      changedKeys: []
    });
    expect(onData).toHaveBeenCalledOnce();
    expect(onData).toHaveBeenCalledWith(target.getData());
    expect(onVisibleRangeChanged).toHaveBeenCalledOnce();
    expect(onVisibleRangeChanged).toHaveBeenCalledWith(
      target.getVisibleTimeRange()
    );
  });

  it("validates the complete state before mutating the chart", () => {
    const source = createChart();
    const sourceDrawings = new DrawingManager();
    source.addPlugin(sourceDrawings);
    source.addIndicator(
      new MovingAverageIndicator(null, { instanceId: "validated-sma" })
    );
    const state = source.toJSON({ contributors: [sourceDrawings] });

    const target = createChart();
    const existing = new MovingAverageIndicator(null, {
      instanceId: "existing-sma"
    });
    target.addIndicator(existing);

    expect(() => target.restoreState(null)).toThrow(
      "Invalid chart state: expected an object."
    );
    expect(() => target.restoreState({ ...state, version: 1 })).toThrow(
      'Unsupported chart state version "1"; expected 2.'
    );
    expect(() =>
      target.restoreState({
        ...state,
        panes: state.panes.map((pane) => ({ ...pane, heightRatio: 0.5 }))
      })
    ).toThrow("Invalid chart state: pane heightRatio values must sum to 1.");
    expect(() => target.restoreState(state)).toThrow(
      "Chart state contains indicators but no indicatorResolver was provided."
    );
    expect(() =>
      target.restoreState(
        { ...state, core: { ...state.core, type: "missing-controller" } },
        { indicatorResolver }
      )
    ).toThrow("Controller: missing-controller is not registered!");
    expect(() => target.restoreState(state, { indicatorResolver })).toThrow(
      'Chart state contribution "drawing-manager" has no matching contributor.'
    );
    expect(target.getIndicators()).toEqual([existing]);

    expect(() =>
      target.restoreState(
        {
          ...state,
          indicators: [state.indicators[0], state.indicators[0]]
        },
        { indicatorResolver, contributors: [new DrawingManager()] }
      )
    ).toThrow(
      'Chart state contains duplicate indicator instanceId "validated-sma".'
    );
  });

  it("rejects duplicate pane ownership and non-JSON contributor state", () => {
    const chart = createChart();
    chart.addIndicator(
      new TestIndicator(null, { instanceId: "validated-pane" })
    );
    const state = chart.toJSON();
    const pane = state.panes.find(
      ({ indicatorInstanceId }) => indicatorInstanceId === "validated-pane"
    )!;

    expect(() =>
      chart.restoreState(
        {
          ...state,
          panes: [...state.panes, { ...pane, id: 99, heightRatio: 0 }]
        },
        { indicatorResolver }
      )
    ).toThrow(
      'Chart state contains multiple panes for indicator "validated-pane".'
    );

    const unsafeContributor: ChartStateContributor = {
      key: "unsafe",
      toJSON: () => ({ callback: () => undefined }),
      fromJSON: () => undefined
    };
    expect(() => chart.toJSON({ contributors: [unsafeContributor] })).toThrow(
      'Chart state contribution "unsafe".callback is not JSON-safe.'
    );
  });

  it("owns contributor state at serialization and restoration boundaries", () => {
    interface ContributionState {
      nested: { value: string };
    }

    const source = createChart();
    const sourceValue: ContributionState = {
      nested: { value: "serialized" }
    };
    const sourceContributor: ChartStateContributor<ContributionState> = {
      key: "owned-contribution",
      toJSON: () => sourceValue,
      fromJSON: () => undefined
    };
    const state = source.toJSON({ contributors: [sourceContributor] });
    const serialized = state.contributions?.[
      sourceContributor.key
    ] as unknown as ContributionState;

    sourceValue.nested.value = "source-mutated";
    expect(serialized.nested.value).toBe("serialized");

    const target = createChart();
    let restored: ContributionState | undefined;
    const targetContributor: ChartStateContributor<ContributionState> = {
      key: sourceContributor.key,
      toJSON: () => ({ nested: { value: "restored" } }),
      fromJSON: (value) => {
        restored = value;
        value.nested.value = "contributor-mutated";
      }
    };

    target.restoreState(state, { contributors: [targetContributor] });

    expect(restored).not.toBe(serialized);
    expect(serialized.nested.value).toBe("serialized");
  });
});
