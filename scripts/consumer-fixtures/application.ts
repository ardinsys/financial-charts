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

// @ts-expect-error Applications subscribe to chart events but cannot publish them.
chart.emit("options-change", {});
// @ts-expect-error Bulk listener cleanup is owned by the chart lifecycle.
chart.removeAllListeners();
// @ts-expect-error Listener bookkeeping is not an application API.
chart.listenerCount();
// @ts-expect-error Render hooks are extension capabilities.
chart.onRenderStage("series", () => {});
// @ts-expect-error Logical canvas sizes are extension capabilities.
chart.getLogicalCanvas("main");
// @ts-expect-error The host element is not exposed by the application facade.
chart.getOutsideContainer();
// @ts-expect-error Drawing dimensions are extension capabilities.
chart.getDrawingSize();
// @ts-expect-error Full canvas dimensions are extension capabilities.
chart.getFullSize();
// @ts-expect-error Scale internals are not application APIs.
chart.getVolumeScale();
// @ts-expect-error Theme data is part of the options snapshot.
chart.getTheme();
// @ts-expect-error Formatter access is part of the options snapshot.
chart.getFormatter();
// @ts-expect-error Resolved locale values are an indicator capability.
chart.getLocaleValues();
// @ts-expect-error Price scales are engine internals.
chart.getPriceScale();
// @ts-expect-error Time anchoring belongs to controllers and panes.
chart.getTimeAnchorAlignment();
// @ts-expect-error Axis dimensions are extension rendering data.
chart.getYLabelWidth();

unsubscribe();
chart.clearData();
chart.dispose();

void [options, mappedData];
