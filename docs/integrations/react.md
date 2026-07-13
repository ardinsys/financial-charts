# React (16.8+)

Use refs and effects to manage the chart lifecycle. Built-in chart types are available by default on each chart instance.

```tsx
// Chart.tsx
import { useEffect, useRef } from "react";
import { FinancialChart, type ChartData } from "@ardinsys/financial-charts";
import "@ardinsys/financial-charts/style.css";

type Props = { data: ChartData[] };

export function Chart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<FinancialChart | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const appLocale = "en"; // wire this to your i18n store
  const localeValues = {
    en: {
      indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } },
      common: { sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" } }
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new FinancialChart(containerRef.current, "auto", {
      type: "candle",
      stepSize: 15 * 60 * 1000,
      maxZoom: 150,
      volume: true,
      locale: "en",
    });

    chart.draw(data);
    lastTimestampRef.current = data.at(-1)?.time ?? null;
    chartRef.current = chart;

    return () => chart.dispose();
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const next = data.at(-1);
    const lastSeen = lastTimestampRef.current;

    if (next && lastSeen && next.time > lastSeen) {
      chart.drawNextPoint(next);
    } else {
      chart.draw(data);
    }

    lastTimestampRef.current = next?.time ?? null;
  }, [data]);

  useEffect(() => {
    chartRef.current?.updateLocalization({
      locale: appLocale,
      localeValues
    });
  }, [appLocale]);

  return <div ref={containerRef} style={{ height: 400 }} />;
}
```

- Keep the container height stable via inline styles or CSS.
- Store the `FinancialChart` instance outside render to avoid re-instantiation.
- Favor a single `data` array. Wrap expensive transforms with `useMemo` so identical feeds don't trigger redundant `draw` calls.
- Call `chart.updateTheme` or `chart.changeType` from event handlers as needed.
