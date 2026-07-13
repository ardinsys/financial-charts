type DeepRequired<T> = T extends Function
  ? T
  : T extends object
    ? { [P in keyof T]-?: DeepRequired<T[P]> }
    : T;

export function mergeThemes<T extends object = ChartTheme>(
  defaultTheme: any,
  providedTheme: any
): T {
  if (providedTheme == undefined) return { ...defaultTheme };
  // @ts-ignore
  const theme: T = {};
  const allKeys = new Set([
    ...Object.keys(defaultTheme),
    ...Object.keys(providedTheme)
  ]);
  for (const key of allKeys) {
    const defaultVal = defaultTheme[key];
    const providedVal = providedTheme[key];

    if (
      typeof defaultVal === "object" &&
      typeof providedVal === "object" &&
      !Array.isArray(defaultVal) &&
      Object.getPrototypeOf(defaultVal)?.constructor === Object &&
      Object.getPrototypeOf(providedVal)?.constructor === Object
    ) {
      // @ts-ignore
      theme[key] = mergeThemes(defaultVal, providedVal);
    } else {
      if (typeof providedVal === "boolean" || typeof providedVal === "number") {
        // @ts-ignore
        theme[key] = providedVal;
      } else {
        // Fallback to default if provided is falsy (null/undefined/empty string), except 0/false
        // @ts-ignore
        theme[key] = providedVal ?? defaultVal;
      }
    }
  }

  return theme;
}

export type Gradient = Array<[number, string]>;

export interface ChartTheme {
  key: string;
  backgroundColor?: string;
  randomColors?: string[];
  volume?: {
    upColor?: string;
    downColor?: string;
  };
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
  hlcArea?: {
    width?: number;
    closeColor?: string;
    high?: {
      color?: string;
      fill?: string;
    };
    low: {
      color?: string;
      fill?: string;
    };
  };
  bar?: {
    upColor?: string;
    downColor?: string;
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
    infoLine?: {
      upColor?: string;
      downColor?: string;
      fontSize?: number;
      font?: string;
      color?: string;
      labels?: Record<string, string[]>;
    };
    tooltip?: {
      backgroundColor?: string;
      color?: string;
      fontSize?: number;
      font?: string;
    };
  };
  drawingAxisBounds?: {
    strokeColor?: string;
    labelBackgroundColor?: string;
    rangeBackgroundColor?: string;
    textColor?: string;
    fontSize?: number;
    font?: string;
    lineWidth?: number;
    borderRadius?: number;
    labelHeight?: number;
    labelPaddingX?: number;
  };
}

export type ResolvedChartTheme = DeepRequired<ChartTheme>;

export const defaultLightTheme: ResolvedChartTheme = {
  key: "light",
  backgroundColor: "#FFFFFF",
  randomColors: [
    "#7841FF",
    "#AE32FF",
    "#FF2BEE",
    "#FF4BA6",
    "#FF6B6B",
    "#FF9047",
    "#FFBC2D",
    "#2BFF3E"
  ],
  volume: {
    upColor: "rgba(8, 153, 129, 0.35)",
    downColor: "rgba(242, 54, 69, 0.35)"
  },
  grid: {
    color: "#F2F3F3",
    width: 1
  },
  candle: {
    upColor: "#609895",
    downColor: "#F23645",
    upWickColor: "#609895",
    downWickColor: "#F23645"
  },
  line: {
    color: "#2962FF",
    width: 1
  },
  area: {
    color: "#2962FF",
    width: 1,
    fill: [
      [0, "rgba(41, 98, 254, 0.4)"],
      [1, "rgba(41, 98, 254, 0)"]
    ]
  },
  hlcArea: {
    width: 1,
    closeColor: "#2962FF",
    high: {
      color: "#609895",
      fill: "rgba(96, 152, 149, 0.1)"
    },
    low: {
      color: "#F23645",
      fill: "rgba(242, 54, 69, 0.1)"
    }
  },
  bar: {
    upColor: "#609895",
    downColor: "#F23645"
  },
  xAxis: {
    color: "#000000",
    fontSize: 12,
    font: "Roboto Mono",
    backgroundColor: "#FFFFFF",
    separatorColor: "#FFFFFF"
  },
  yAxis: {
    color: "#000000",
    fontSize: 12,
    font: "Roboto Mono",
    backgroundColor: "#FFFFFF"
  },
  crosshair: {
    color: "#9598A1",
    width: 1,
    lineDash: [5, 6],
    infoLine: {
      upColor: "#609895",
      downColor: "#F23645",
      fontSize: 12,
      font: "Roboto Mono",
      color: "#000000",
      labels: { "*": ["O: ", "H: ", "L: ", "C: ", "V: "] }
    },
    tooltip: {
      backgroundColor: "#131722",
      color: "#FFFFFF",
      fontSize: 12,
      font: "Roboto Mono"
    }
  },
  drawingAxisBounds: {
    strokeColor: "rgba(217, 158, 0, 0.9)",
    labelBackgroundColor: "#FFF4CC",
    rangeBackgroundColor: "rgba(217, 158, 0, 0.18)",
    textColor: "#7C5800",
    fontSize: 11,
    font: "Roboto Mono",
    lineWidth: 1,
    borderRadius: 5,
    labelHeight: 22,
    labelPaddingX: 8
  }
};

export const defaultDarkTheme: ResolvedChartTheme = {
  key: "dark",
  backgroundColor: "#161A25",
  randomColors: [
    "#7841FF",
    "#AE32FF",
    "#FF2BEE",
    "#FF4BA6",
    "#FF6B6B",
    "#FF9047",
    "#FFBC2D",
    "#2BFF3E"
  ],
  volume: {
    upColor: "rgba(8, 153, 129, 0.35)",
    downColor: "rgba(242, 54, 69, 0.35)"
  },
  grid: {
    color: "#232632",
    width: 1
  },
  candle: {
    upColor: "#089981",
    downColor: "#F23645",
    upWickColor: "#089981",
    downWickColor: "#F23645"
  },
  line: {
    color: "#2962FE",
    width: 1
  },
  area: {
    color: "#2962FE",
    width: 1,
    fill: [
      [0, "rgba(41, 98, 254, 0.4)"],
      [1, "rgba(41, 98, 254, 0)"]
    ]
  },
  hlcArea: {
    width: 1,
    closeColor: "#2962FF",
    high: {
      color: "#609895",
      fill: "rgba(96, 152, 149, 0.1)"
    },
    low: {
      color: "#F23645",
      fill: "rgba(242, 54, 69, 0.1)"
    }
  },
  bar: {
    upColor: "#089981",
    downColor: "#F23645"
  },
  xAxis: {
    color: "#B2B5BE",
    fontSize: 12,
    font: "Roboto",
    separatorColor: "#161A25",
    backgroundColor: "#161A25"
  },
  yAxis: {
    color: "#B2B5BE",
    fontSize: 12,
    font: "Roboto",
    backgroundColor: "#161A25"
  },
  crosshair: {
    color: "#9598A1",
    width: 1,
    lineDash: [5, 6],
    infoLine: {
      upColor: "#089981",
      downColor: "#F23645",
      fontSize: 12,
      font: "Roboto Mono",
      color: "#FFFFFF",
      labels: { "*": ["O: ", "H: ", "L: ", "C: ", "V: "] }
    },
    tooltip: {
      backgroundColor: "#363A45",
      color: "#FFFFFF",
      fontSize: 12,
      font: "Roboto Mono"
    }
  },
  drawingAxisBounds: {
    strokeColor: "rgba(234, 179, 8, 0.9)",
    labelBackgroundColor: "#3A2E0F",
    rangeBackgroundColor: "rgba(234, 179, 8, 0.18)",
    textColor: "#FDE68A",
    fontSize: 11,
    font: "Roboto Mono",
    lineWidth: 1,
    borderRadius: 5,
    labelHeight: 22,
    labelPaddingX: 8
  }
};
