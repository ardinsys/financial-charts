type DeepRequired<T> = T extends Function
  ? T
  : T extends object
    ? { [P in keyof T]-?: DeepRequired<T[P]> }
    : T;

export type Gradient = Array<[number, string]>;

export type BuiltInChartThemeKey = "light" | "dark";
export type ChartThemeKey = string;

export interface ChartTheme {
  /** Built-in theme whose values complete this definition. Defaults to light. */
  base?: BuiltInChartThemeKey;
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
    low?: {
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
  priceAxisAnnotation?: {
    color?: string;
    labelColor?: string;
    textColor?: string;
    lineWidth?: number;
    emphasisLineWidth?: number;
    lineDash?: number[];
    fontSize?: number;
    font?: string;
    labelHeight?: number;
    labelPaddingX?: number;
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
}

export type ChartThemeMap = Readonly<Record<string, ChartTheme>>;

export type ResolvedChartTheme = DeepRequired<Omit<ChartTheme, "base">> & {
  readonly key: ChartThemeKey;
  readonly base: BuiltInChartThemeKey;
};

export const defaultLightTheme: ResolvedChartTheme = {
  key: "light",
  base: "light",
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
  priceAxisAnnotation: {
    color: "#2962FF",
    labelColor: "#1565C0",
    textColor: "#FFFFFF",
    lineWidth: 1,
    emphasisLineWidth: 2.5,
    lineDash: [],
    fontSize: 12,
    font: "Roboto Mono",
    labelHeight: 18,
    labelPaddingX: 4
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
  }
};

export const defaultDarkTheme: ResolvedChartTheme = {
  key: "dark",
  base: "dark",
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
  priceAxisAnnotation: {
    color: "#FFA726",
    labelColor: "#F57C00",
    textColor: "#FFFFFF",
    lineWidth: 1.5,
    emphasisLineWidth: 3,
    lineDash: [],
    fontSize: 12,
    font: "Roboto Mono",
    labelHeight: 18,
    labelPaddingX: 4
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
  }
};
