# React (16.8+)

Use refs and effects to manage the chart lifecycle. Built-in chart types are available by default on each chart instance.

```tsx
import { useEffect, useRef } from "react";
import { FinancialChart, type ChartData } from "@ardinsys/financial-charts";
import "@ardinsys/financial-charts/style.css";

type Props = {
  data: readonly ChartData[];
  locale: string;
};

const localeValues = {
  en: {
    indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } },
    common: { sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" } }
  }
};

export function Chart({ data, locale }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<FinancialChart | null>(null);
  const appliedDataRef = useRef<readonly ChartData[] | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = new FinancialChart(containerRef.current, {
      timeRange: "auto",
      type: "candle",
      stepSize: 15 * 60 * 1000,
      maxZoom: 150,
      volume: true,
    });

    chartRef.current = chart;

    return () => {
      chart.dispose();
      chartRef.current = null;
      appliedDataRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    if (appliedDataRef.current === data) return;
    chart.setData(data);
    appliedDataRef.current = data;
  }, [data]);

  useEffect(() => {
    chartRef.current?.updateLocalization({
      locale,
      localeValues
    });
  }, [locale]);

  return <div ref={containerRef} style={{ height: 400 }} />;
}
```

- Keep the container height stable via inline styles or CSS.
- Store the `FinancialChart` instance outside render to avoid re-instantiation.
- Treat a replaced `data` prop as a complete snapshot. For a websocket or other
  single-candle feed, call `updateData(point)` at the feed boundary rather than
  inferring streaming semantics from array differences.
- Memoize expensive data transforms so referentially identical snapshots do not
  trigger redundant `setData()` calls.
- Call `chart.updateTheme` or `chart.changeType` from event handlers as needed.
- In SSR frameworks, render the container on the server but create the chart in
  a client-only effect.
