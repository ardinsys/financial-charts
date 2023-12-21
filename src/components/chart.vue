<script lang="ts" setup>
import { ref, onMounted, watch, PropType } from "vue";
import type { TimeRange, ChartData } from "../controllers/types";

const props = defineProps({
  type: {
    type: String as PropType<"candle" | "line" | "area">,
    default: () => "line",
  },
  timeRange: {
    type: Object as PropType<TimeRange>,
    required: true,
  },
  design: {
    type: Object as PropType<{
      strokeWidth?: number;
      areaColor?: {
        type: "solid" | "gradient";
        color?: string;
        gradient?: Record<string, string>;
      };
      candle?: {
        upColor?: string;
        downColor?: string;
        wickColor?: string;
      };
    }>,
    default: () => null,
  },
  data: {
    type: Array as PropType<ChartData[]>,
    default: () => [],
  },
  locale: {
    type: String,
    default: () => "en-US",
  },
});

const chartContainer = ref(null);

watch(
  () => props.data,
  (newData) => {
    // Update chart with new data
  }
);

onMounted(() => {
  // Initialize chart with chartContainer and options
});
</script>

<template>
  <div
    ref="chartContainer"
    style="
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    "
  ></div>
</template>
