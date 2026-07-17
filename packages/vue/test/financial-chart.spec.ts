import {
  createApp,
  defineComponent,
  h,
  nextTick,
  reactive,
  shallowRef,
  type PropType,
} from "vue";
import {
  DefaultDOMAdapter,
  MovingAverageIndicator,
  type ChartData,
  type ChartOptions,
  type FinancialChart as FinancialChartInstance,
} from "@ardinsys/financial-charts";
import type {
  IndicatorLabelActions,
  IndicatorLabelModel,
} from "@ardinsys/financial-charts/extensions";
import { describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/financial-chart";

describe("FinancialChart Vue component", () => {
  it("owns chart lifecycle and applies data and runtime option changes", async () => {
    const options = reactive<ChartOptions>({
      stepSize: 60_000,
      theme: "light",
    });
    const data = shallowRef<readonly ChartData[]>([{ time: 0, close: 100 }]);
    const ready = vi.fn<(chart: FinancialChartInstance) => void>();
    const Root = defineComponent({
      setup() {
        return () =>
          h(FinancialChart, {
            options,
            data: data.value,
            style: "width: 800px; height: 400px",
            onReady: ready,
          });
      },
    });
    const appHost = document.body.appendChild(document.createElement("div"));
    const app = createApp(Root);
    app.mount(appHost);
    await nextTick();

    expect(ready).toHaveBeenCalledOnce();
    const firstChart = ready.mock.calls[0][0];
    expect(firstChart.getData()).toEqual([{ time: 0, close: 100 }]);

    data.value = [
      { time: 0, close: 100 },
      { time: 60_000, close: 101 },
    ];
    options.theme = "dark";
    await nextTick();
    expect(firstChart.getData()).toHaveLength(2);
    expect(firstChart.getOptions().theme.key).toBe("dark");

    const firstDispose = vi.spyOn(firstChart, "dispose");
    options.domAdapter = new DefaultDOMAdapter();
    await nextTick();
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(ready).toHaveBeenCalledTimes(2);

    const currentChart = ready.mock.calls[1][0];
    const currentDispose = vi.spyOn(currentChart, "dispose");
    app.unmount();
    expect(currentDispose).toHaveBeenCalledOnce();
    appHost.remove();
  });

  it("renders a matching indicator label as an app-native component", async () => {
    const Label = defineComponent({
      props: {
        model: {
          type: Object as PropType<IndicatorLabelModel>,
          required: true,
        },
        actions: {
          type: Object as PropType<IndicatorLabelActions>,
          required: true,
        },
      },
      setup(props) {
        return () => h("span", { class: "custom-sma" }, props.model.name);
      },
    });
    const renderCount = shallowRef(0);
    const ready = vi.fn((chart: FinancialChartInstance) => {
      chart.addIndicator(new MovingAverageIndicator());
    });
    const appHost = document.body.appendChild(document.createElement("div"));
    const app = createApp({
      render: () =>
        h(FinancialChart, {
          options: { stepSize: 60_000 },
          data: [{ time: 0, close: 100 }],
          indicatorLabels: { SMA: Label },
          "data-render": renderCount.value,
          style: "width: 800px; height: 400px",
          onReady: ready,
        }),
    });
    app.mount(appHost);
    await nextTick();

    expect(appHost.querySelector(".custom-sma")?.textContent).toBe(
      "Simple Moving Average",
    );
    renderCount.value++;
    await nextTick();
    expect(ready).toHaveBeenCalledOnce();
    app.unmount();
    appHost.remove();
  });
});
