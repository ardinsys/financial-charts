<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
// import { LineController } from "./controllers/line/line-controller";
import { CandlestickController } from "./controllers/candlestick/candle-controller";
import { LineController } from "./controllers/line/line-controller";
import {
  MDDClient,
  defaultParsers,
  DataType,
  HistoricalChartType,
} from "@asys-private/mdd-client";
import { ChartData } from "./controllers/types";
import { defaultDarkTheme } from "./controllers/themes";

const chartContainer = ref<HTMLElement>();
const clickedData = ref<ChartData>();

// Date that represents today 17:00
const fivepm = new Date();
fivepm.setHours(17, 0, 0, 0);

// Date that represents today 09:00
const nineam = new Date();
nineam.setHours(9, 0, 0, 0);

const chartData = ref<ChartData[]>([]);
let controller: CandlestickController;

const fiveYear = new Date();
fiveYear.setFullYear(fiveYear.getFullYear() - 5);
fiveYear.setHours(1, 0, 0, 0);

onMounted(() => {
  controller = new CandlestickController(
    chartContainer.value!,
    {
      start: fiveYear.getTime(),
      end: fivepm.getTime(),
    },
    {
      // theme: defaultDarkTheme,
      maxZoom: 100,
      stepSize: 24 * 60 * 60 * 1000,
    }
  );

  controller.setEventListener("click", (_: MouseEvent, data) => {
    clickedData.value = data;
  });

  const mdd = new MDDClient(
    "ws://192.168.68.60:3000/mdd/ws",
    "teszt",
    1,
    2000,
    1000
  );
  mdd.registerParsers(...defaultParsers);

  mdd.connect(2000).then(async () => {
    const ins = { dataType: DataType.CHART_DATA, isin: "TESZT", mic: "XETR" };
    await mdd.subscribeInstrument(ins);
    mdd.getHistoricalChart(ins, HistoricalChartType.FIVE_YEAR).then((data) => {
      chartData.value = data.map((c) => ({
        time: c.time,
        close: c.close,
        high: c.high,
        low: c.low,
        open: c.open,
      }));
    });
    // const [init] = await mdd.getInitData([
    //   { ...ins, from: nineam, to: fivepm },
    // ]);
    // if (init?.type === DataType.CHART_DATA) {
    //   chartData.value = init.chartData.map((c) => ({
    //     time: new Date(c.timestamp).getTime(),
    //     close: c.close,
    //     high: c.high,
    //     low: c.low,
    //     open: c.open,
    //   }));
    // }

    // mdd.registerUpdateObserver({
    //   dataTypes: [DataType.CHART_DATA],
    //   observer: (data) => {
    //     if (data.type === DataType.CHART_DATA) {
    //       chartData.value = [
    //         ...chartData.value,
    //         {
    //           time: new Date(data.timestamp).getTime(),
    //           close: data.close,
    //           high: data.high,
    //           low: data.low,
    //           open: data.open,
    //         },
    //       ];
    //     }
    //   },
    // });
  });

  // controller.draw([
  //   // 1. candle
  //   {
  //     time: nineam.getTime(),
  //     open: 11,
  //     high: 15,
  //     low: 10,
  //     close: 10,
  //   },
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 15,
  //     open: 10,
  //     high: 15,
  //     low: 8,
  //     close: 15,
  //   },
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 30,
  //     open: 15,
  //     high: 17,
  //     low: 11,
  //     close: 12,
  //   },
  //   // 2. candle
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 45,
  //     open: 12,
  //     high: 15,
  //     low: 10,
  //     close: 13,
  //   },
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 60,
  //     open: 13,
  //     high: 13,
  //     low: 8,
  //     close: 11,
  //   },
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 75,
  //     open: 11,
  //     high: 14,
  //     low: 10,
  //     close: 14,
  //   },
  //   // 3. candle
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 90,
  //     open: 13,
  //     high: 15,
  //     low: 10,
  //     close: 12,
  //   },
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 115,
  //     open: 11,
  //     high: 16,
  //     low: 10,
  //     close: 12,
  //   },
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 130,
  //     open: 14,
  //     high: 15,
  //     low: 10,
  //     close: 12,
  //   },
  //   // 4. candle
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 145,
  //     open: 12,
  //     high: 15,
  //     low: 8,
  //     close: 10,
  //   },
  //   // sokadik
  //   {
  //     time: nineam.getTime() + 1000 * 60 * 160,
  //     open: 10,
  //     high: 15,
  //     low: 8,
  //     close: 12,
  //   },
  // ]);

  // setTimeout(() => {
  //   controller.drawNextPoint({
  //     time: nineam.getTime() + 1000 * 60 * 175,
  //     close: 14,
  //     high: 13,
  //     low: 10,
  //     open: 11,
  //   });

  //   setTimeout(() => {
  //     controller.drawNextPoint({
  //       time: nineam.getTime() + 1000 * 60 * 175,
  //       close: 13,
  //       high: 14,
  //       low: 10,
  //       open: 11,
  //     });
  //   }, 2000);
  // }, 2000);
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
        background: white;
        width: min(80%, 1200px);
        height: min(90vh, 600px);
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
    <div style="margin-top: 20px">{{ clickedData }}</div>
    <div id="test"></div>
  </div>
</template>

<style>
body {
  margin: 0;
}
</style>
