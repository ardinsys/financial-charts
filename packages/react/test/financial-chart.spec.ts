import {
  act,
  createContext,
  createElement,
  createRef,
  useContext,
} from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import {
  DefaultDOMAdapter,
  MovingAverageIndicator,
  type ChartData,
  type ChartOptions,
  type FinancialChart as FinancialChartInstance,
} from "@ardinsys/financial-charts";
import { describe, expect, it, vi } from "vitest";
import { FinancialChart } from "../src/financial-chart";
import type {
  FinancialChartHandle,
  IndicatorLabelRendererProps,
} from "../src/types";

describe("FinancialChart React component", () => {
  it("renders its host without constructing a chart during SSR", () => {
    expect(
      renderToString(
        createElement(FinancialChart, {
          options: { stepSize: 60_000 },
          className: "chart",
        })
      )
    ).toBe('<div class="chart"></div>');
  });

  it("owns chart lifecycle and applies data and runtime option changes", async () => {
    const ready = vi.fn<(chart: FinancialChartInstance) => void>();
    const chartHandle = createRef<FinancialChartHandle>();
    const appHost = document.body.appendChild(document.createElement("div"));
    const root = createRoot(appHost);
    let options: ChartOptions = {
      stepSize: 60_000,
      theme: "light",
    };
    let data: readonly ChartData[] = [{ time: 0, close: 100 }];

    await act(async () => {
      root.render(
        createElement(FinancialChart, {
          ref: chartHandle,
          options,
          data,
          style: { width: 800, height: 400 },
          onReady: ready,
        })
      );
    });

    expect(ready).toHaveBeenCalledOnce();
    const firstChart = ready.mock.calls[0][0];
    expect(chartHandle.current?.chart).toBe(firstChart);
    expect(firstChart.getData()).toEqual([{ time: 0, close: 100 }]);

    data = [
      { time: 0, close: 100 },
      { time: 60_000, close: 101 },
    ];
    options = { ...options, theme: "dark", wheelZoom: "modifier" };
    await act(async () => {
      root.render(
        createElement(FinancialChart, {
          ref: chartHandle,
          options,
          data,
          style: { width: 800, height: 400 },
          onReady: ready,
        })
      );
    });
    expect(firstChart.getData()).toHaveLength(2);
    expect(firstChart.getOptions().theme.key).toBe("dark");
    expect(firstChart.getOptions().wheelZoom).toBe("modifier");

    const firstDispose = vi.spyOn(firstChart, "dispose");
    options = { ...options, domAdapter: new DefaultDOMAdapter() };
    await act(async () => {
      root.render(
        createElement(FinancialChart, {
          ref: chartHandle,
          options,
          data,
          style: { width: 800, height: 400 },
          onReady: ready,
        })
      );
    });
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(ready).toHaveBeenCalledTimes(2);

    const currentChart = ready.mock.calls[1][0];
    const currentDispose = vi.spyOn(currentChart, "dispose");
    await act(async () => root.unmount());
    expect(currentDispose).toHaveBeenCalledOnce();
    expect(chartHandle.current).toBeNull();
    appHost.remove();
  });

  it("renders matching indicator labels inside the React context tree", async () => {
    const AppContext = createContext("missing");
    const Label = ({ model }: IndicatorLabelRendererProps) =>
      createElement(
        "span",
        { className: "custom-sma" },
        `${useContext(AppContext)}:${model.name}`
      );
    const indicatorLabels = { SMA: Label };
    const ready = vi.fn((chart: FinancialChartInstance) => {
      chart.addIndicator(new MovingAverageIndicator());
    });
    const appHost = document.body.appendChild(document.createElement("div"));
    const root = createRoot(appHost);

    const render = (renderCount: number) =>
      createElement(
        AppContext.Provider,
        { value: "portfolio" },
        createElement(FinancialChart, {
          options: { stepSize: 60_000 },
          data: [{ time: 0, close: 100 }],
          indicatorLabels,
          title: String(renderCount),
          style: { width: 800, height: 400 },
          onReady: ready,
        })
      );

    await act(async () => root.render(render(0)));
    expect(appHost.querySelector(".custom-sma")?.textContent).toBe(
      "portfolio:Simple Moving Average"
    );

    await act(async () => root.render(render(1)));
    expect(ready).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    appHost.remove();
  });
});
