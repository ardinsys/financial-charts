import {
  FinancialChart,
  type ChartData,
  type ChartOptionsChangeEvent
} from "@ardinsys/financial-charts";

declare const container: HTMLElement;

const chart = new FinancialChart(container, { stepSize: 60_000 });
const data: ChartData[] = [
  { time: 0, close: 100 },
  { time: 60_000, close: 101 }
];

chart.setData(data);
chart.updateData({ time: 120_000, close: 102 });
chart.updateOptions({ type: "line", volume: false });
chart.setVisibleTimeRange({ start: 0, end: 120_000 });

const unsubscribe = chart.on(
  "options-change",
  (event: ChartOptionsChangeEvent) => void event.changedKeys
);
const options = chart.getOptions();
const mappedData = chart.getData();

unsubscribe();
chart.clearData();
chart.dispose();

void [options, mappedData];
