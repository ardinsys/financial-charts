<script setup lang="ts">
import "./app-styles.css";

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  DrawingAxisBoundsPlugin,
  DrawingManager,
  DrawingSelectionPlugin,
  FinancialChart,
  MovingAverageIndicator,
  TestIndicator,
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
  stepSize
} from "./market-data";
import { SelectedDrawingToolbarPlugin } from "./plugins/selected-drawing-toolbar";

const chartContainer = ref<HTMLElement>();
const activeDrawingTool = ref<DrawingTool>();
const indicatorDialogOpen = ref(false);
const indicatorSettingsOpen = ref(false);
const selectedIndicator = ref<Indicator<any, any>>();
const movingAveragePeriod = ref(9);
const movingAverageSource = ref<MovingAverageOptions["source"]>("close");

const priceChange = (lastPoint.close ?? 0) - (previousPoint.close ?? 0);
const priceChangeClass = computed(() =>
  priceChange >= 0 ? "price-up" : "price-down"
);
const selectedIndicatorTitle = computed(() => {
  const indicator = selectedIndicator.value;
  if (!indicator) return "";

  return indicator.getOptions().names.default ?? indicator.getKey();
});

let chart: FinancialChart | undefined;
let drawingManager: DrawingManager | undefined;
let indicatorIndex = 0;

function setDrawingTool(tool: DrawingTool) {
  if (activeDrawingTool.value === tool) {
    clearDrawingTool();
    return;
  }

  activeDrawingTool.value = tool;
  drawingManager?.setDrawingFactory(createDrawingFactory(tool));
}

function clearDrawingTool() {
  activeDrawingTool.value = undefined;
  drawingManager?.setDrawingFactory(undefined);
}

function deleteSelectedDrawing() {
  drawingManager?.deleteSelected();
}

function addIndicator(kind: IndicatorKind) {
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
  if (chart && selectedIndicator.value) {
    chart.removeIndicator(selectedIndicator.value);
  }
  indicatorSettingsOpen.value = false;
  selectedIndicator.value = undefined;
}

onMounted(() => {
  chart = new FinancialChart(
    chartContainer.value!,
    {
      start: initialData[0].time,
      end: initialData.at(-1)!.time + stepSize
    },
    {
      type: "candle",
      theme: darkTheme,
      locale: "en-US",
      maxZoom: 90,
      stepSize,
      volume: true
    }
  );

  drawingManager = new DrawingManager();
  const selectedDrawingToolbar = new SelectedDrawingToolbarPlugin(
    drawingManager
  );
  chart.addPlugin(drawingManager);
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
});

onBeforeUnmount(() => {
  chart?.dispose();
  chart = undefined;
  drawingManager = undefined;
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
          <span>15m</span>
          <span :class="['last-price', priceChangeClass]">
            {{ formatNumber(lastPoint.close ?? 0) }}
          </span>
          <span :class="priceChangeClass">
            {{ priceChange >= 0 ? "+" : "" }}{{ formatNumber(priceChange) }}
          </span>
        </div>

        <div class="topbar-actions">
          <button class="command-button" type="button">15m</button>
          <button class="command-button" type="button">Candles</button>
          <button
            class="command-button command-button--primary"
            type="button"
            @click="indicatorDialogOpen = true"
          >
            Indicators
          </button>
        </div>
      </header>

      <section class="chart-stage">
        <div ref="chartContainer" class="chart-host"></div>
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
