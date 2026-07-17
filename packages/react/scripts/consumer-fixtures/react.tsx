import { createRef } from "react";
import type { ChartOptions } from "@ardinsys/financial-charts";
import {
  FinancialChart,
  ReactDOMAdapter,
  type FinancialChartHandle,
  type IndicatorLabelRendererMap,
  type IndicatorLabelRendererProps,
} from "@ardinsys/financial-charts-react";

function OrdersLabel({ model, actions }: IndicatorLabelRendererProps) {
  return <button onClick={actions.onRemove}>{model.name}</button>;
}

const options: ChartOptions = { stepSize: 60_000 };
const indicatorLabels: IndicatorLabelRendererMap = {
  orders: OrdersLabel,
};
const chart = createRef<FinancialChartHandle>();
const element = (
  <FinancialChart
    ref={chart}
    options={options}
    data={[{ time: 0, close: 100 }]}
    indicatorLabels={indicatorLabels}
    onReady={(instance) => instance.updateData({ time: 60_000, close: 101 })}
  />
);
const adapter = new ReactDOMAdapter({ indicatorLabels });

void [element, adapter, chart.current?.chart];
