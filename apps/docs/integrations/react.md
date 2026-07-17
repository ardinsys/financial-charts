# React (16.8+)

The official `@ardinsys/financial-charts-react` package owns the chart lifecycle,
applies prop changes, and lets React components render chart-managed DOM such as
indicator labels.

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
  timeRange: "auto",
  type: "candle",
  stepSize: 15 * 60 * 1000,
  maxZoom: 150,
  volume: true,
};

type Props = {
  data: readonly ChartData[];
};

export function Chart({ data }: Props) {
  const chart = useRef<FinancialChartHandle>(null);

  function applyLivePoint(point: ChartData) {
    chart.current?.chart?.updateData(point);
  }

  return (
    <FinancialChart
      ref={chart}
      options={options}
      data={data}
      style={{ height: 400 }}
      onReady={(instance) => {
        // Attach plugins or restore state that depends on them here.
      }}
    />
  );
}
```

The component creates the chart in an effect and disposes it during cleanup.
Runtime option changes call `updateOptions()`. Construction-only option changes
recreate the chart. Replacing `data` calls `setData()` only when the array
identity changes; a live one-candle feed should call `updateData()` through the
exposed instance.

The component renders only its host element during server rendering. The chart
constructor runs on the client after mounting.

## React indicator labels

Register components using the indicator's `labelKey`. The component receives
the current label model and its supported actions:

```tsx
import { createContext, useContext } from "react";
import {
  FinancialChart,
  type FinancialChartProps,
  IndicatorLabelRendererMap,
  IndicatorLabelRendererProps,
} from "@ardinsys/financial-charts-react";

const AccountContext = createContext("default");

function OrderLabel({ model, actions }: IndicatorLabelRendererProps) {
  const account = useContext(AccountContext);

  return (
    <div className="order-label">
      <span>{account}</span>
      <span>{model.name}</span>
      {model.actions.canRemove && (
        <button type="button" onClick={actions.onRemove}>
          {model.actionTitles.remove}
        </button>
      )}
    </div>
  );
}

const indicatorLabels: IndicatorLabelRendererMap = {
  orders: OrderLabel,
};

export function Chart({ options, data }: FinancialChartProps) {
  return (
    <AccountContext.Provider value="Primary account">
      <FinancialChart
        options={options}
        data={data}
        indicatorLabels={indicatorLabels}
      />
    </AccountContext.Provider>
  );
}
```

Labels render through React portals, so context, hooks, and React event bubbling
work normally. A label without a registered component uses the core default DOM
renderer. Use the `indicatorLabel` prop as a custom fallback for every unmatched
label.

`ReactDOMAdapter` and `ReactDOMPortals` are exported for applications that own
their chart lifecycle but still want React-rendered labels or pane dividers.
