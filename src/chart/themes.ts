import { DeepConcrete } from "./financial-chart";

export function mergeThemes(
  defaultTheme: ChartTheme,
  providedTheme: ChartTheme
) {
  if (providedTheme == undefined)
    return { ...defaultTheme } as DeepConcrete<ChartTheme>;
  // @ts-ignore
  const theme: DeepConcrete<ChartTheme> = {};
  for (const k in defaultTheme) {
    const key = k as keyof ChartTheme;
    if (
      typeof defaultTheme[key] === "object" &&
      !Array.isArray(defaultTheme[key])
    ) {
      // @ts-ignore
      theme[key] = mergeThemes(
        defaultTheme[key] as ChartTheme,
        providedTheme[key] as ChartTheme
      );
    } else {
      // @ts-ignore
      theme[key] = providedTheme[key] || defaultTheme[key];
    }
  }
  return theme;
}

export type Gradient = Array<[number, string]>;

export interface ChartTheme {
  backgroundColor?: string;
  grid?: {
    color?: string;
    width?: number;
  };
  candle?: {
    upColor?: string;
    downColor?: string;
    upWickColor?: string;
    downWickColor?: string;
  };
  line?: {
    color?: string;
    width?: number;
  };
  area?: {
    color?: string;
    width?: number;
    fill?: string | Gradient;
  };
  xAxis?: {
    color?: string;
    fontSize?: number;
    font?: string;
    backgroundColor?: string;
    separatorColor?: string;
  };
  yAxis?: {
    color?: string;
    fontSize?: number;
    font?: string;
    backgroundColor?: string;
  };
  crosshair?: {
    color?: string;
    width?: number;
    lineDash?: number[];
    tooltip?: {
      backgroundColor?: string;
      color?: string;
      fontSize?: number;
      font?: string;
    };
  };
}

export const defaultLightTheme: DeepConcrete<ChartTheme> = {
  backgroundColor: "#FFFFFF",
  grid: {
    color: "#F2F3F3",
    width: 1,
  },
  candle: {
    upColor: "#609895",
    downColor: "#F23645",
    upWickColor: "#609895",
    downWickColor: "#F23645",
  },
  line: {
    color: "#2962FF",
    width: 1,
  },
  area: {
    color: "#2962FF",
    width: 1,
    fill: [
      [0, "rgba(41, 98, 254, 0.4)"],
      [1, "rgba(41, 98, 254, 0)"],
    ],
  },
  xAxis: {
    color: "#000000",
    fontSize: 12,
    font: "Roboto Mono",
    backgroundColor: "#FFFFFF",
    separatorColor: "#FFFFFF",
  },
  yAxis: {
    color: "#000000",
    fontSize: 12,
    font: "Roboto Mono",
    backgroundColor: "#FFFFFF",
  },
  crosshair: {
    color: "#9598A1",
    width: 1,
    lineDash: [5, 6],
    tooltip: {
      backgroundColor: "#131722",
      color: "#FFFFFF",
      fontSize: 12,
      font: "Roboto Mono",
    },
  },
};

export const defaultDarkTheme: DeepConcrete<ChartTheme> = {
  backgroundColor: "#161A25",
  grid: {
    color: "#232632",
    width: 1,
  },
  candle: {
    upColor: "#089981",
    downColor: "#F23645",
    upWickColor: "#089981",
    downWickColor: "#F23645",
  },
  line: {
    color: "#2962FE",
    width: 1,
  },
  area: {
    color: "#2962FE",
    width: 1,
    fill: [
      [0, "rgba(41, 98, 254, 0.4)"],
      [1, "rgba(41, 98, 254, 0)"],
    ],
  },
  xAxis: {
    color: "#B2B5BE",
    fontSize: 12,
    font: "Roboto",
    separatorColor: "#161A25",
    backgroundColor: "#161A25",
  },
  yAxis: {
    color: "#B2B5BE",
    fontSize: 12,
    font: "Roboto",
    backgroundColor: "#161A25",
  },
  crosshair: {
    color: "#9598A1",
    width: 1,
    lineDash: [5, 6],
    tooltip: {
      backgroundColor: "#363A45",
      color: "#FFFFFF",
      fontSize: 12,
      font: "Roboto Mono",
    },
  },
};
