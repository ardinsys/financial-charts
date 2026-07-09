<script setup lang="ts">
import "./app-styles.css";

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from "vue";
import {
  ChartSyncPlugin,
  DrawingAxisBoundsPlugin,
  DrawingManager,
  DrawingSelectionPlugin,
  FinancialChart,
  MovingAverageIndicator,
  TestIndicator,
  type ChartData,
  type ControllerType,
  type Indicator,
  type MovingAverageOptions
} from "@ardinsys/financial-charts";
import {
  createDrawingFactory,
  drawingTools,
  type DrawingTool
} from "./drawing-tools";
import { indicatorCatalog, type IndicatorKind } from "./indicator-catalog";
import {
  darkTheme,
  formatNumber,
  createSessionData,
  initialData,
  lastPoint,
  previousPoint,
  stepSize as baseStepSize
} from "./market-data";
import { SelectedDrawingToolbarPlugin } from "./plugins/selected-drawing-toolbar";

const timeframeOptions = [
  { label: "15m", value: baseStepSize },
  { label: "30m", value: 30 * 60 * 1000 },
  { label: "1h", value: 60 * 60 * 1000 },
  { label: "4h", value: 4 * 60 * 60 * 1000 }
] as const;

const chartTypeOptions: Array<{ label: string; value: ControllerType }> = [
  { label: "Candles", value: "candle" },
  { label: "Line", value: "line" },
  { label: "Step", value: "stepline" },
  { label: "Area", value: "area" },
  { label: "Bars", value: "bar" },
  { label: "Hollow", value: "hollow-candle" },
  { label: "HLC Area", value: "hlc-area" }
];

type ChartLayoutMode = "single" | "grid" | "stress";
type ChartSlotColumn = "primary" | "comparison";

interface ChartSlot {
  column: ChartSlotColumn;
  data: ChartData[];
  id: string;
  stepSize: number;
}

const layoutOptions: Array<{
  label: string;
  title: string;
  value: ChartLayoutMode;
}> = [
  { label: "1", title: "Single chart", value: "single" },
  { label: "9", title: "9 chart grid", value: "grid" },
  { label: "Sync", title: "Synced chart stress grid", value: "stress" }
];

const chartHosts = new Map<string, HTMLElement>();
const chartStageKey = ref(0);
const chartLayoutMode = ref<ChartLayoutMode>("single");
const selectedChartType = ref<ControllerType>("candle");
const selectedTimeframeMs = ref<number>(baseStepSize);
const stressChartsPerColumn = ref(20);
const pendingStressChartsPerColumn = ref(stressChartsPerColumn.value);
const activeDrawingTool = ref<DrawingTool>();
const indicatorDialogOpen = ref(false);
const indicatorSettingsOpen = ref(false);
const selectedIndicator = ref<Indicator<any, any>>();
const movingAveragePeriod = ref(9);
const movingAverageSource = ref<MovingAverageOptions["source"]>("close");
const syncGroup = "playground-sync";

const priceChange = (lastPoint.close ?? 0) - (previousPoint.close ?? 0);
const priceChangeClass = computed(() =>
  priceChange >= 0 ? "price-up" : "price-down"
);
const stressTotalCharts = computed(() => stressChartsPerColumn.value * 2);
const comparisonStepSize = computed(() => selectedTimeframeMs.value * 2);
const comparisonData = computed(() =>
  createSessionData(
    initialData[0].time - comparisonStepSize.value * 24,
    132,
    comparisonStepSize.value,
    {
      impulseScale: 1.35,
      startPrice: 176.8,
      trendBias: 0.08
    }
  )
);
const chartSlots = computed<ChartSlot[]>(() => {
  if (chartLayoutMode.value === "stress") {
    return [
      ...createChartSlots("primary", initialData, selectedTimeframeMs.value, {
        count: stressChartsPerColumn.value
      }),
      ...createChartSlots(
        "comparison",
        comparisonData.value,
        comparisonStepSize.value,
        { count: stressChartsPerColumn.value }
      )
    ];
  }

  const count = chartLayoutMode.value === "grid" ? 9 : 1;
  return createChartSlots("primary", initialData, selectedTimeframeMs.value, {
    count,
    prefix: "standard"
  });
});
const primaryStressSlots = computed(() =>
  chartSlots.value.filter((slot) => slot.column === "primary")
);
const comparisonStressSlots = computed(() =>
  chartSlots.value.filter((slot) => slot.column === "comparison")
);
const selectedTimeframeLabel = computed(
  () =>
    timeframeOptions.find(
      (option) => option.value === selectedTimeframeMs.value
    )?.label ?? formatTimeframeLabel(selectedTimeframeMs.value)
);
const comparisonTimeframeLabel = computed(() =>
  formatTimeframeLabel(comparisonStepSize.value)
);
const selectedIndicatorTitle = computed(() => {
  const indicator = selectedIndicator.value;
  if (!indicator) return "";

  return indicator.getOptions().names.default ?? indicator.getKey();
});

interface PlaygroundChart {
  chart: FinancialChart;
  drawingManager: DrawingManager;
  slot: ChartSlot;
}

let charts: PlaygroundChart[] = [];
let indicatorIndex = 0;
const minStressChartsPerColumn = 1;
const maxStressChartsPerColumn = 100;

function createChartSlots(
  column: ChartSlotColumn,
  data: ChartData[],
  stepSize: number,
  options: { count?: number; prefix?: string } = {}
): ChartSlot[] {
  const count = options.count ?? 100;
  const prefix = options.prefix ?? column;

  return Array.from({ length: count }, (_, index) => ({
    column,
    data,
    id: `${prefix}-${index}`,
    stepSize
  }));
}

function setChartHost(element: Element | null, id: string) {
  if (element instanceof HTMLElement) {
    chartHosts.set(id, element);
  } else {
    chartHosts.delete(id);
  }
}

function formatTimeframeLabel(value: number) {
  return value % (60 * 60 * 1000) === 0
    ? `${value / (60 * 60 * 1000)}h`
    : `${value / 60000}m`;
}

function getPrimaryChart() {
  return charts[0]?.chart;
}

function setDrawingTool(tool: DrawingTool) {
  if (activeDrawingTool.value === tool) {
    clearDrawingTool();
    return;
  }

  activeDrawingTool.value = tool;
  for (const item of charts) {
    item.drawingManager.setDrawingFactory(createDrawingFactory(tool));
  }
}

function clearDrawingTool() {
  activeDrawingTool.value = undefined;
  for (const item of charts) {
    item.drawingManager.setDrawingFactory(undefined);
  }
}

function deleteSelectedDrawing() {
  const manager =
    charts.find((item) => item.drawingManager.getSelectedDrawing())
      ?.drawingManager ?? charts[0]?.drawingManager;
  manager?.deleteSelected();
}

function setChartLayout(mode: ChartLayoutMode) {
  if (chartLayoutMode.value === mode) return;
  chartLayoutMode.value = mode;
}

function normalizeStressCount(value: number) {
  if (!Number.isFinite(value)) return stressChartsPerColumn.value;

  return Math.min(
    maxStressChartsPerColumn,
    Math.max(minStressChartsPerColumn, Math.round(value))
  );
}

function applyStressCount() {
  const nextCount = normalizeStressCount(pendingStressChartsPerColumn.value);
  pendingStressChartsPerColumn.value = nextCount;
  if (nextCount === stressChartsPerColumn.value) return;

  stressChartsPerColumn.value = nextCount;
  if (chartLayoutMode.value === "stress") {
    void rebuildCharts({ remount: true });
  }
}

function getChartTimeRange(data: ChartData[], stepSize: number) {
  return {
    start: data[0].time,
    end: data.at(-1)!.time + stepSize
  };
}

function applyChartType() {
  for (const item of charts) {
    item.chart.changeType(selectedChartType.value);
  }
}

function applyTimeframe() {
  const slotsById = new Map(chartSlots.value.map((slot) => [slot.id, slot]));
  for (const item of charts) {
    const nextSlot = slotsById.get(item.slot.id);
    if (!nextSlot) continue;

    item.slot = nextSlot;
    item.chart.updateCoreOptions(
      getChartTimeRange(nextSlot.data, nextSlot.stepSize),
      nextSlot.stepSize,
      90
    );
    item.chart.draw(nextSlot.data);
  }
}

function addIndicator(kind: IndicatorKind) {
  const chart = getPrimaryChart();
  if (!chart) return;

  indicatorIndex += 1;
  if (kind === "moving-average") {
    chart.addIndicator(
      new MovingAverageIndicator(null, {
        key: `SMA-${indicatorIndex}`,
        names: { default: "Moving Average" },
        period: 9,
        source: "close"
      })
    );
  } else {
    chart.addIndicator(
      new TestIndicator(null, {
        key: `MARKERS-${indicatorIndex}`,
        names: { default: "Pane Markers" }
      })
    );
  }

  indicatorDialogOpen.value = false;
}

function openIndicatorSettings(indicator: Indicator<any, any>) {
  selectedIndicator.value = indicator;

  if (indicator instanceof MovingAverageIndicator) {
    const options = indicator.getOptions();
    movingAveragePeriod.value = options.period;
    movingAverageSource.value = options.source;
  }

  indicatorSettingsOpen.value = true;
}

function applyIndicatorSettings() {
  const indicator = selectedIndicator.value;
  if (indicator instanceof MovingAverageIndicator) {
    indicator.updateOptions({
      period: Math.max(1, Math.round(movingAveragePeriod.value)),
      source: movingAverageSource.value
    });
  }

  indicatorSettingsOpen.value = false;
}

function removeSelectedIndicator() {
  const indicator = selectedIndicator.value;
  if (indicator) {
    const owner =
      charts.find((item) => item.chart.getAllIndicators().includes(indicator))
        ?.chart ?? getPrimaryChart();
    owner?.removeIndicator(indicator);
  }
  indicatorSettingsOpen.value = false;
  selectedIndicator.value = undefined;
}

function createChart(root: HTMLElement, slot: ChartSlot): PlaygroundChart {
  const chart = new FinancialChart(
    root,
    getChartTimeRange(slot.data, slot.stepSize),
    {
      type: selectedChartType.value,
      theme: darkTheme,
      locale: "en-US",
      maxZoom: 90,
      stepSize: slot.stepSize,
      volume: true
    }
  );

  const drawingManager = new DrawingManager();
  const selectedDrawingToolbar = new SelectedDrawingToolbarPlugin(
    drawingManager
  );
  chart.addPlugin(drawingManager);
  chart.addPlugin(new ChartSyncPlugin({ group: syncGroup, drawingManager }));
  chart.addPlugin(new DrawingAxisBoundsPlugin());
  chart.addPlugin(selectedDrawingToolbar);
  chart.addPlugin(
    new DrawingSelectionPlugin((drawing) => {
      selectedDrawingToolbar.setSelectedDrawing(drawing);
    })
  );

  chart.on("drawing-finished", ({ operation }) => {
    if (operation === "create") {
      clearDrawingTool();
    }
  });

  chart.on("indicator-settings-open", ({ indicator }) => {
    openIndicatorSettings(indicator);
  });

  chart.on("indicator-remove", ({ indicator }) => {
    if (selectedIndicator.value === indicator) {
      selectedIndicator.value = undefined;
      indicatorSettingsOpen.value = false;
    }
  });

  chart.draw(slot.data);

  return { chart, drawingManager, slot };
}

function disposeCharts() {
  for (const item of charts) {
    item.chart.dispose();
  }
  charts = [];
  selectedIndicator.value = undefined;
  indicatorSettingsOpen.value = false;
}

async function rebuildCharts(options: { remount?: boolean } = {}) {
  disposeCharts();

  if (options.remount) {
    chartHosts.clear();
    chartStageKey.value += 1;
  }

  await nextTick();

  charts = chartSlots.value
    .map((slot) => ({ host: chartHosts.get(slot.id), slot }))
    .filter(
      (item): item is { host: HTMLElement; slot: ChartSlot } =>
        item.host instanceof HTMLElement
    )
    .map(({ host, slot }) => createChart(host, slot));

  if (activeDrawingTool.value) {
    const factory = createDrawingFactory(activeDrawingTool.value);
    for (const item of charts) {
      item.drawingManager.setDrawingFactory(factory);
    }
  }
}

watch(chartLayoutMode, () => {
  void rebuildCharts({ remount: true });
});

onMounted(() => {
  void rebuildCharts();
});

onBeforeUnmount(() => {
  disposeCharts();
});
</script>

<template>
  <div class="terminal">
    <aside class="drawing-rail" aria-label="Drawing tools">
      <button
        v-for="tool in drawingTools"
        :key="tool.id"
        :class="{ active: activeDrawingTool === tool.id }"
        :title="tool.label"
        class="tool-button"
        type="button"
        @click="setDrawingTool(tool.id)"
      >
        <span :class="['tool-icon', `tool-icon--${tool.icon}`]"></span>
      </button>

      <div class="rail-divider"></div>

      <button
        class="tool-button tool-button--danger"
        title="Delete selected drawing"
        type="button"
        @click="deleteSelectedDrawing"
      >
        <span class="tool-icon tool-icon--delete"></span>
      </button>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div class="symbol-block">
          <span class="exchange">NASDAQ</span>
          <strong>ARDS</strong>
          <span>{{ selectedTimeframeLabel }}</span>
          <span :class="['last-price', priceChangeClass]">
            {{ formatNumber(lastPoint.close ?? 0) }}
          </span>
          <span :class="priceChangeClass">
            {{ priceChange >= 0 ? "+" : "" }}{{ formatNumber(priceChange) }}
          </span>
        </div>

        <div class="topbar-actions">
          <select
            v-model.number="selectedTimeframeMs"
            class="command-select"
            title="Timeframe"
            @change="applyTimeframe"
          >
            <option
              v-for="option in timeframeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <select
            v-model="selectedChartType"
            class="command-select"
            title="Chart type"
            @change="applyChartType"
          >
            <option
              v-for="option in chartTypeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <div class="layout-switch" aria-label="Chart layout">
            <button
              v-for="option in layoutOptions"
              :key="option.value"
              :class="{ active: chartLayoutMode === option.value }"
              :title="option.title"
              class="layout-switch__button"
              type="button"
              @click="setChartLayout(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <label class="stress-count-control" title="Charts per sync column">
            <span>Charts</span>
            <input
              v-model.number="pendingStressChartsPerColumn"
              :max="maxStressChartsPerColumn"
              :min="minStressChartsPerColumn"
              type="number"
              @blur="applyStressCount"
              @change="applyStressCount"
              @keydown.enter="applyStressCount"
            />
            <span>{{ stressTotalCharts }}</span>
          </label>
          <button
            class="command-button command-button--primary"
            type="button"
            @click="indicatorDialogOpen = true"
          >
            Indicators
          </button>
        </div>
      </header>

      <section
        v-if="chartLayoutMode === 'stress'"
        :key="`${chartLayoutMode}-${chartStageKey}`"
        class="chart-stage chart-stage--stress"
      >
        <div class="stress-column stress-column--primary">
          <header class="stress-column-header">
            <strong>ARDS</strong>
            <span
              >{{ selectedTimeframeLabel }} ·
              {{ primaryStressSlots.length }}</span
            >
          </header>
          <div
            v-for="slot in primaryStressSlots"
            :key="slot.id"
            class="chart-cell chart-cell--stress"
          >
            <div
              :ref="
                (element) => setChartHost(element as Element | null, slot.id)
              "
              class="chart-host"
            ></div>
          </div>
        </div>

        <div class="stress-scroll-gutter" aria-hidden="true"></div>

        <div class="stress-column stress-column--comparison">
          <header class="stress-column-header">
            <strong>ARDS-X</strong>
            <span
              >{{ comparisonTimeframeLabel }} ·
              {{ comparisonStressSlots.length }}</span
            >
          </header>
          <div
            v-for="slot in comparisonStressSlots"
            :key="slot.id"
            class="chart-cell chart-cell--stress"
          >
            <div
              :ref="
                (element) => setChartHost(element as Element | null, slot.id)
              "
              class="chart-host"
            ></div>
          </div>
        </div>
      </section>

      <section
        v-else
        :key="`${chartLayoutMode}-${chartStageKey}`"
        :class="[
          'chart-stage',
          { 'chart-stage--grid': chartLayoutMode === 'grid' }
        ]"
      >
        <div v-for="slot in chartSlots" :key="slot.id" class="chart-cell">
          <div
            :ref="(element) => setChartHost(element as Element | null, slot.id)"
            class="chart-host"
          ></div>
        </div>
      </section>
    </main>

    <div
      v-if="indicatorDialogOpen"
      class="modal-backdrop"
      @click.self="indicatorDialogOpen = false"
    >
      <section class="modal">
        <header class="modal-header">
          <h2>Indicators</h2>
          <button type="button" @click="indicatorDialogOpen = false">
            Close
          </button>
        </header>

        <div class="indicator-list">
          <button
            v-for="indicator in indicatorCatalog"
            :key="indicator.id"
            class="indicator-option"
            type="button"
            @click="addIndicator(indicator.id)"
          >
            <strong>{{ indicator.name }}</strong>
            <span>{{ indicator.detail }}</span>
          </button>
        </div>
      </section>
    </div>

    <div
      v-if="indicatorSettingsOpen"
      class="modal-backdrop"
      @click.self="indicatorSettingsOpen = false"
    >
      <section class="modal modal--settings">
        <header class="modal-header">
          <h2>{{ selectedIndicatorTitle }}</h2>
          <button type="button" @click="indicatorSettingsOpen = false">
            Close
          </button>
        </header>

        <div
          v-if="selectedIndicator instanceof MovingAverageIndicator"
          class="settings-grid"
        >
          <label>
            Period
            <input v-model.number="movingAveragePeriod" min="1" type="number" />
          </label>
          <label>
            Source
            <select v-model="movingAverageSource">
              <option value="open">Open</option>
              <option value="high">High</option>
              <option value="low">Low</option>
              <option value="close">Close</option>
            </select>
          </label>
        </div>

        <p v-else class="settings-empty">
          This pane indicator has no editable inputs.
        </p>

        <footer class="modal-actions">
          <button
            class="ghost-button"
            type="button"
            @click="removeSelectedIndicator"
          >
            Remove
          </button>
          <button
            class="primary-button"
            type="button"
            @click="applyIndicatorSettings"
          >
            Apply
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>
