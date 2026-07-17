<script setup lang="ts">
import type { ControllerType } from "@ardinsys/financial-charts";

const { copy } = useSiteLocale();
const activeType = ref<ControllerType>("candle");
const types = computed<Array<{ id: ControllerType; label: string }>>(() => [
  { id: "candle", label: copy.value.lab.types.candle },
  { id: "line", label: copy.value.lab.types.line },
  { id: "area", label: copy.value.lab.types.area },
  { id: "bar", label: copy.value.lab.types.bar },
  { id: "hollow-candle", label: copy.value.lab.types.hollow },
  { id: "hlc-area", label: copy.value.lab.types.hlc },
]);
</script>

<template>
  <div class="chart-lab instrument-panel" data-reveal>
    <div class="instrument-header">
      <div class="instrument-symbol">
        <span class="status-dot" />
        <div>
          <strong>ARDIN / EUR</strong>
          <small>{{ copy.lab.live }}</small>
        </div>
      </div>
      <div class="instrument-price">
        <strong>184.26</strong>
        <span>+1.42%</span>
      </div>
      <div class="instrument-meta mono">
        <span>O 182.14</span><span>H 185.02</span><span>L 181.76</span
        ><span>V 2.84M</span>
      </div>
    </div>

    <div
      class="chart-type-switch"
      role="tablist"
      :aria-label="copy.lab.chartType"
    >
      <button
        v-for="type in types"
        :key="type.id"
        :class="{ active: activeType === type.id }"
        type="button"
        role="tab"
        :aria-selected="activeType === type.id"
        @click="activeType = type.id"
      >
        {{ type.label }}
      </button>
    </div>

    <div class="lab-chart-wrap">
      <MarketChart :type="activeType" live volume indicator />
      <div class="chart-watermark">ARDIN</div>
    </div>

    <div class="instrument-footer mono">
      <span><i class="legend-candle" />{{ copy.lab.timeframe }}</span>
      <span><i class="legend-volume" />{{ copy.lab.volume }}</span>
      <span><i class="legend-average" />{{ copy.lab.indicator }}</span>
      <span class="render-state">● {{ copy.lab.rendering }}</span>
    </div>
  </div>
</template>
