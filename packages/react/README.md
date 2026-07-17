# @ardinsys/financial-charts-react

Official React lifecycle and DOM integration for
`@ardinsys/financial-charts`.

## Installation

```bash
pnpm add @ardinsys/financial-charts @ardinsys/financial-charts-react
```

Import the core stylesheet once in the application:

```ts
import "@ardinsys/financial-charts/style.css";
```

## Chart component

```tsx
import { useRef } from "react";
import type { ChartData, ChartOptions } from "@ardinsys/financial-charts";
import {
  FinancialChart,
  type FinancialChartHandle,
} from "@ardinsys/financial-charts-react";

const options: ChartOptions = {
  stepSize: 60_000,
  theme: "dark",
};

export function PriceChart({ data }: { data: readonly ChartData[] }) {
  const chart = useRef<FinancialChartHandle>(null);

  function onLivePoint(point: ChartData) {
    chart.current?.chart?.updateData(point);
  }

  return (
    <FinancialChart
      ref={chart}
      className="chart"
      options={options}
      data={data}
    />
  );
}
```

The component creates the chart after mounting and disposes it during cleanup.
Runtime option changes use `updateOptions()`. Changes to controllers, themes,
or the DOM adapter recreate the chart. Replacing `data` calls `setData()`; live
points should use the exposed chart instance.

## Custom indicator labels

Label renderers are ordinary React components receiving `model` and `actions`.
Register them by the indicator's `labelKey`:

```tsx
import {
  FinancialChart,
  type FinancialChartProps,
  IndicatorLabelRendererMap,
  IndicatorLabelRendererProps,
} from "@ardinsys/financial-charts-react";

function OrderLabel({ model, actions }: IndicatorLabelRendererProps) {
  return (
    <button type="button" onClick={actions.onRemove}>
      {model.name} {model.detail}
    </button>
  );
}

const indicatorLabels: IndicatorLabelRendererMap = {
  orders: OrderLabel,
};

export function PriceChart({ options, data }: FinancialChartProps) {
  return (
    <FinancialChart
      options={options}
      data={data}
      indicatorLabels={indicatorLabels}
    />
  );
}
```

Custom labels are rendered as React portals, so they retain application context
and event propagation. Indicators without a matching renderer continue to use
the core default DOM label. `ReactDOMAdapter` and `ReactDOMPortals` are also
exported for applications that need to integrate the DOM adapter with their own
chart wrapper.
