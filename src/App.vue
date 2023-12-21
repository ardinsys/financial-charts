<script setup lang="ts">
import { onMounted, ref } from "vue";
// import { LineController } from "./controllers/line/line-controller";
import { CandlestickController } from "./controllers/candlestick/candle-controller";

const chartContainer = ref<HTMLElement>();

// Date that represents today 17:00
const fivepm = new Date();
fivepm.setHours(17, 0, 0, 0);

// Date that represents today 09:00
const nineam = new Date();
nineam.setHours(9, 0, 0, 0);

onMounted(() => {
  const controller = new CandlestickController(
    chartContainer.value!,
    {
      start: nineam.getTime(),
      end: fivepm.getTime(),
    },
    {
      stepSize: 15 * 60 * 1000,
    }
  );

  controller.draw([
    // 1. candle
    {
      time: nineam.getTime(),
      open: 11,
      high: 15,
      low: 10,
      close: 10,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 15,
      open: 10,
      high: 15,
      low: 8,
      close: 15,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 30,
      open: 15,
      high: 17,
      low: 11,
      close: 12,
    },
    // 2. candle
    {
      time: nineam.getTime() + 1000 * 60 * 45,
      open: 12,
      high: 15,
      low: 10,
      close: 13,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 60,
      open: 13,
      high: 13,
      low: 8,
      close: 11,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 75,
      open: 11,
      high: 14,
      low: 10,
      close: 14,
    },
    // 3. candle
    {
      time: nineam.getTime() + 1000 * 60 * 90,
      open: 13,
      high: 15,
      low: 10,
      close: 12,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 115,
      open: 11,
      high: 16,
      low: 10,
      close: 12,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 130,
      open: 14,
      high: 15,
      low: 10,
      close: 12,
    },
    // 4. candle
    {
      time: nineam.getTime() + 1000 * 60 * 145,
      open: 12,
      high: 15,
      low: 8,
      close: 10,
    },
    // sokadik
    {
      time: nineam.getTime() + 1000 * 60 * 160,
      open: 10,
      high: 15,
      low: 8,
      close: 12,
    },
  ]);

  setTimeout(() => {
    controller.drawNextPoint({
      time: nineam.getTime() + 1000 * 60 * 175,
      close: 14,
      high: 13,
      low: 10,
      open: 11,
    });

    setTimeout(() => {
      controller.drawNextPoint({
        time: nineam.getTime() + 1000 * 60 * 175,
        close: 13,
        high: 14,
        low: 10,
        open: 11,
      });
    }, 2000);
  }, 2000);
});
</script>

<template>
  <div
    style="
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    "
  >
    <div
      style="
        background: white;
        width: min(80%, 1600px);
        height: min(90vh, 900px);
        /* width: 100%;
        height: 100%; */
        position: relative;
        overflow: hidden;
        border-radius: 5px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        padding: 0px;
      "
    >
      <div
        ref="chartContainer"
        style="width: 100%; height: 100%; position: relative"
      ></div>
    </div>
  </div>
</template>

<style>
body {
  margin: 0;
}
</style>
