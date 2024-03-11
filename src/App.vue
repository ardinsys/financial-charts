<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
// import { LineController } from "./controllers/line/line-controller";
import { ChartData } from "./chart/types";
import { FinancialChart } from "./chart/financial-chart";
import { AreaController } from "./controllers/area-controller";
import { LineController } from "./controllers/line-controller";
import { BarController } from "./controllers/bar-controller";
import { HollowCandleController } from "./controllers/hollow-candle-controller";
import { CandlestickController } from "./controllers/candle-controller";
import { SteplineController } from "./controllers/step-line-controller";
import { HLCAreaController } from "./controllers/hlc-area-controller";
import { defaultDarkTheme } from "./chart/themes";
import { MovingAverageIndicator } from "./indicators/moving-average";

FinancialChart.registerController(AreaController);
FinancialChart.registerController(LineController);
FinancialChart.registerController(CandlestickController);
FinancialChart.registerController(BarController);
FinancialChart.registerController(HollowCandleController);
FinancialChart.registerController(SteplineController);
FinancialChart.registerController(HLCAreaController);

const chartContainer = ref<HTMLElement>();
const clickedData = ref<ChartData>();

// Date that represents today 17:00
const fivepm = new Date();
fivepm.setHours(17, 0, 0, 0);

// Date that represents today 09:00
const nineam = new Date();
nineam.setHours(9, 0, 0, 0);

const chartData = ref<ChartData[]>([]);
let controller: FinancialChart;

const fiveYear = new Date();
fiveYear.setFullYear(fiveYear.getFullYear() - 5);

onMounted(() => {
  controller = new FinancialChart(
    chartContainer.value!,
    "auto",
    // {
    //   start: nineam.getTime(),
    //   end: fivepm.getTime(),
    //   // end: nineam.getTime() + 1000 * 60 * 180,
    // },
    {
      type: "candle",
      theme: defaultDarkTheme,
      // locale: "HU",
      maxZoom: 100,
      stepSize: 15 * 60 * 1000,
      volume: true,
    }
  );

  controller.addIndicator(
    new MovingAverageIndicator({
      light: {
        color: "gray",
        strokeWidth: 2,
      },
      dark: {
        color: "wheat",
        strokeWidth: 2,
      },
    })
  );

  controller.setEventListener("click", (_: MouseEvent, data) => {
    clickedData.value = data;
  });
  controller.setEventListener("touch-click", (_: TouchEvent, data) => {
    // @ts-ignore
    clickedData.value = { ...data, touch: true };
  });

  controller.draw([
    // 1. candle
    {
      time: nineam.getTime(),
      open: 11,
      high: 15,
      low: 9,
      close: 12,
      volume: 100_000,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 15,
      open: 10,
      high: 15,
      low: 8,
      close: 12,
      volume: 1_200_000,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 30,
      open: 15,
      high: 17,
      low: 11,
      close: 12,
      volume: 800_000,
    },
    // 2. candle
    {
      time: nineam.getTime() + 1000 * 60 * 45,
      open: 12,
      high: 15,
      low: 10,
      close: 13,
      volume: 1_500_000,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 60,
      open: 13,
      high: 13,
      low: 8,
      close: 11,
      volume: 1_400_000,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 75,
      open: 11,
      high: 14,
      low: 10,
      close: 14,
      volume: 1_450_000,
    },
    // 3. candle
    {
      time: nineam.getTime() + 1000 * 60 * 90,
      open: 13,
      high: 15,
      low: 10,
      close: 12,
      volume: 1_600_000,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 115,
      open: 11,
      high: 16,
      low: 10,
      close: 12,
      volume: 1_800_000,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 130,
      open: 14,
      high: 15,
      low: 10,
      close: 12,
      volume: 1_550_000,
    },
    // 4. candle
    {
      time: nineam.getTime() + 1000 * 60 * 145,
      open: 12,
      high: 15,
      low: 8,
      close: 10,
      volume: 1_200_000,
    },
    {
      time: nineam.getTime() + 1000 * 60 * 160,
      open: 10,
      high: 15,
      low: 8,
      close: 12,
      volume: 1_300_000,
    },
  ]);

  // setTimeout(() => {
  //   controller.updateCoreOptions(
  //     {
  //       start: nineam.getTime(),
  //       end: fivepm.getTime(),
  //     },
  //     15 * 60 * 1000,
  //     10
  //   );
  // }, 2000);

  // setTimeout(() => {
  //     controller.drawNextPoint({
  //       time: nineam.getTime() + 1000 * 60 * 175,
  //       close: 14,
  //       high: 13,
  //       low: 10,
  //       open: 11,
  //     });

  //     setTimeout(() => {
  //       controller.drawNextPoint({
  //         time: nineam.getTime() + 1000 * 60 * 175,
  //         close: 13,
  //         high: 14,
  //         low: 10,
  //         open: 11,
  //       });

  //       setTimeout(() => {
  //         controller.drawNextPoint({
  //           time: nineam.getTime() + 1000 * 60 * 190,
  //           close: 14,
  //           high: 16,
  //           low: 11,
  //           open: 13,
  //         });

  //         setTimeout(() => {
  //           controller.drawNextPoint({
  //             time: nineam.getTime() + 1000 * 60 * 205,
  //             close: 12,
  //             high: 15,
  //             low: 8,
  //             open: 14,
  //           });
  //         }, 2000);
  //       }, 2000);
  //     }, 2000);
  //   }, 2000);
});

watch(chartData, (newVal, oldVal) => {
  if (!controller) return;
  if (oldVal.length > 0 && newVal.length > 0) {
    controller.drawNextPoint(newVal[newVal.length - 1]);
  } else {
    controller.draw(newVal);
  }
});
</script>

<template>
  <div
    style="
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      flex-direction: column;
      user-select: none;
    "
  >
    <div
      style="
        width: min(80%, 1200px);
        height: min(90vh, 600px);
        /* width: 100%;
        height: 100%; */
        position: relative;
        overflow: hidden;
        border-radius: 15px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
        padding: 20px;
        padding-right: 5px;
        background: #161a25;
      "
      ref="chartContainer"
    ></div>
    <div style="margin-top: 20px">{{ clickedData }}</div>
    <div id="test"></div>
  </div>
</template>

<style>
body {
  margin: 0;
}
</style>
