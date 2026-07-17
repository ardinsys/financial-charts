import type { ChartData, ChartThemeMap } from "@ardinsys/financial-charts";

export const stepSize = 15 * 60 * 1000;

const sessionStart = new Date();
sessionStart.setHours(9, 30, 0, 0);

export const initialData = createSessionData(
  sessionStart.getTime(),
  72,
  stepSize
);
export const lastPoint = initialData.at(-1)!;
export const previousPoint = initialData.at(-2)!;

export const chartThemes = {
  playground: {
    base: "dark",
    backgroundColor: "#131722",
    candle: {
      upColor: "#22ab94",
      upWickColor: "#22ab94",
      downColor: "#f23645",
      downWickColor: "#f23645",
    },
    grid: {
      color: "rgba(120, 123, 134, 0.18)",
      width: 1,
    },
    xAxis: {
      backgroundColor: "#131722",
      color: "#9aa4b2",
      separatorColor: "#2a2e39",
    },
    yAxis: {
      backgroundColor: "#131722",
      color: "#9aa4b2",
    },
    crosshair: {
      color: "#75808f",
      tooltip: {
        backgroundColor: "#1f2937",
        color: "#f8fafc",
      },
      infoLine: {
        color: "#cbd5e1",
        labels: {
          "en-US": ["O ", "H ", "L ", "C ", "V "],
          "*": ["O ", "H ", "L ", "C ", "V "],
        },
      },
    },
  },
} satisfies ChartThemeMap;

export interface SessionDataOptions {
  impulseScale?: number;
  startPrice?: number;
  trendBias?: number;
}

export function createSessionData(
  start: number,
  length: number,
  interval: number,
  options: SessionDataOptions = {}
): ChartData[] {
  const data: ChartData[] = [];
  let previousClose = options.startPrice ?? 184.25;
  const impulseScale = options.impulseScale ?? 1;
  const trendBias = options.trendBias ?? 0;

  for (let index = 0; index < length; index++) {
    const drift =
      Math.sin(index / 4) * 1.2 + Math.cos(index / 9) * 0.8 + trendBias;
    const impulse =
      (index % 17 === 0 ? 1.4 : index % 23 === 0 ? -1.2 : 0) * impulseScale;
    const open = previousClose;
    const close = open + drift * 0.32 + impulse;
    const high = Math.max(open, close) + 0.45 + (index % 5) * 0.08;
    const low = Math.min(open, close) - 0.42 - (index % 7) * 0.06;

    data.push({
      time: start + index * interval,
      open: roundPrice(open),
      high: roundPrice(high),
      low: roundPrice(low),
      close: roundPrice(close),
      volume:
        850_000 + Math.round(Math.abs(close - open) * 420_000) + index * 4500,
    });

    previousClose = close;
  }

  return data;
}

function roundPrice(value: number) {
  return Math.round(value * 100) / 100;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
