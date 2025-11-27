# React (16.8+)

Use refs and effects to manage the chart lifecycle. Register controllers once at module scope to avoid duplicate registrations during hot reload.

```ts
// controllers.ts
import {
  FinancialChart,
  AreaController,
  LineController,
  BarController,
  HollowCandleController,
  CandlestickController,
  SteplineController,
  HLCAreaController,
} from "@ardinsys/financial-charts";

let controllersRegistered = false;

export function registerControllers() {
  if (controllersRegistered) return;

  FinancialChart.registerController(AreaController);
  FinancialChart.registerController(LineController);
  FinancialChart.registerController(BarController);
  FinancialChart.registerController(HollowCandleController);
  FinancialChart.registerController(CandlestickController);
  FinancialChart.registerController(SteplineController);
  FinancialChart.registerController(HLCAreaController);

  controllersRegistered = true;
}
```

```tsx
// Chart.tsx
import { useEffect, useRef } from "react";
import { FinancialChart, type Candle } from "@ardinsys/financial-charts";
import "@ardinsys/financial-charts/dist/style.css";
import { registerControllers } from "./controllers";

type Props = { data: Candle[]; latest?: Candle };

export function Chart({ data, latest }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<FinancialChart | null>(null);
  const appLocale = "en"; // wire this to your i18n store
  const localeValues = {
    en: {
      indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } },
      common: { sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" } }
    }
  };

  useEffect(() => {
    registerControllers();
    if (!containerRef.current) return;

    const chart = new FinancialChart(containerRef.current, "auto", {
      type: "candlestick",
      stepSize: 15 * 60 * 1000,
      maxZoom: 150,
      volume: true,
      locale: "EN",
    });

    chart.draw(data);
    chartRef.current = chart;

    return () => chart.dispose();
  }, []);

  useEffect(() => {
    chartRef.current?.draw(data);
  }, [data]);

  useEffect(() => {
    chartRef.current?.updateLocale(appLocale, localeValues);
  }, [appLocale]);

  useEffect(() => {
    if (latest) chartRef.current?.drawNextPoint(latest);
  }, [latest]);

  return <div ref={containerRef} style={{ height: 400 }} />;
}
```

- Keep the container height stable via inline styles or CSS.
- Store the `FinancialChart` instance outside render to avoid re-instantiation.
- Call `chart.updateTheme` or `chart.changeType` from event handlers as needed.
