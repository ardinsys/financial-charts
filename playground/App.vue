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

const chartHosts = ref<HTMLElement[]>([]);
const chartCount = ref<1 | 9>(1);
const selectedChartType = ref<ControllerType>("candle");
const selectedTimeframeMs = ref<number>(baseStepSize);
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
const chartSlots = computed(() =>
  Array.from({ length: chartCount.value }, (_, index) => index)
);
const chartLayoutLabel = computed(() =>
  chartCount.value === 1 ? "9 charts" : "1 chart"
);
const selectedTimeframeLabel = computed(
  () =>
    timeframeOptions.find(
      (option) => option.value === selectedTimeframeMs.value
    )?.label ?? `${selectedTimeframeMs.value / 60000}m`
);
const selectedIndicatorTitle = computed(() => {
  const indicator = selectedIndicator.value;
  if (!indicator) return "";

  return indicator.getOptions().names.default ?? indicator.getKey();
});

interface PlaygroundChart {
  chart: FinancialChart;
  drawingManager: DrawingManager;
}

let charts: PlaygroundChart[] = [];
let indicatorIndex = 0;

function setChartHost(element: Element | null, index: number) {
  if (element instanceof HTMLElement) {
    chartHosts.value[index] = element;
  }
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

function toggleChartLayout() {
  chartCount.value = chartCount.value === 1 ? 9 : 1;
}

function getChartTimeRange() {
  return {
    start: initialData[0].time,
    end: initialData.at(-1)!.time + selectedTimeframeMs.value
  };
}

function applyChartType() {
  for (const item of charts) {
    item.chart.changeType(selectedChartType.value);
  }
}

function applyTimeframe() {
  for (const item of charts) {
    item.chart.updateCoreOptions(
      getChartTimeRange(),
      selectedTimeframeMs.value,
      90
    );
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

function createChart(root: HTMLElement): PlaygroundChart {
  const chart = new FinancialChart(root, getChartTimeRange(), {
    type: selectedChartType.value,
    theme: darkTheme,
    locale: "en-US",
    maxZoom: 90,
    stepSize: selectedTimeframeMs.value,
    volume: true
  });

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

  chart.draw(initialData);

  return { chart, drawingManager };
}

function disposeCharts() {
  for (const item of charts) {
    item.chart.dispose();
  }
  charts = [];
  selectedIndicator.value = undefined;
  indicatorSettingsOpen.value = false;
}

async function rebuildCharts() {
  disposeCharts();
  chartHosts.value = [];
  await nextTick();

  charts = chartSlots.value
    .map((slot) => chartHosts.value[slot])
    .filter((host): host is HTMLElement => host instanceof HTMLElement)
    .map((host) => createChart(host));

  if (activeDrawingTool.value) {
    const factory = createDrawingFactory(activeDrawingTool.value);
    for (const item of charts) {
      item.drawingManager.setDrawingFactory(factory);
    }
  }
}

watch(chartCount, () => {
  void rebuildCharts();
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
          <button
            class="command-button"
            type="button"
            @click="toggleChartLayout"
          >
            {{ chartLayoutLabel }}
          </button>
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
        :class="['chart-stage', { 'chart-stage--grid': chartCount === 9 }]"
      >
        <div v-for="slot in chartSlots" :key="slot" class="chart-cell">
          <div
            :ref="(element) => setChartHost(element as Element | null, slot)"
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
