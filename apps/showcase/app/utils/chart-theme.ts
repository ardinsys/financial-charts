import type { ChartThemeMap } from "@ardinsys/financial-charts";

export const showcaseChartThemes = {
  "showcase-dark": {
    base: "dark",
    backgroundColor: "#0d1d26",
    candle: {
      upColor: "#4fb6a6",
      upWickColor: "#4fb6a6",
      downColor: "#eb1a28",
      downWickColor: "#eb1a28",
    },
    grid: { color: "rgba(157, 178, 189, .11)", width: 1 },
    line: { color: "#4a9ed8", width: 2 },
    area: {
      color: "#4a9ed8",
      width: 2,
      fill: [
        [0, "rgba(74, 158, 216, .34)"],
        [1, "rgba(74, 158, 216, 0)"],
      ],
    },
    xAxis: {
      backgroundColor: "#0d1d26",
      color: "#7f9aa7",
      separatorColor: "#17313d",
      font: "Roboto Mono",
    },
    yAxis: {
      backgroundColor: "#0d1d26",
      color: "#7f9aa7",
      font: "Roboto Mono",
    },
    crosshair: {
      color: "#8ca5b1",
      infoLine: { color: "#9db2bd", font: "Roboto Mono" },
    },
  },
  "showcase-light": {
    base: "light",
    backgroundColor: "#ffffff",
    candle: {
      upColor: "#2f857c",
      upWickColor: "#2f857c",
      downColor: "#eb1a28",
      downWickColor: "#eb1a28",
    },
    grid: { color: "rgba(19, 41, 52, .075)", width: 1 },
    line: { color: "#2e78a8", width: 2 },
    area: {
      color: "#2e78a8",
      width: 2,
      fill: [
        [0, "rgba(74, 158, 216, .24)"],
        [1, "rgba(74, 158, 216, 0)"],
      ],
    },
    xAxis: {
      backgroundColor: "#ffffff",
      color: "#51707e",
      separatorColor: "#e8eef1",
      font: "Roboto Mono",
    },
    yAxis: {
      backgroundColor: "#ffffff",
      color: "#51707e",
      font: "Roboto Mono",
    },
    crosshair: {
      color: "#6d8996",
      infoLine: { color: "#51707e", font: "Roboto Mono" },
    },
  },
} satisfies ChartThemeMap;

export function showcaseThemeKey(mode: string | undefined) {
  return mode === "light" ? "showcase-light" : "showcase-dark";
}
