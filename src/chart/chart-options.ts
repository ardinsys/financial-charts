import type { ChartController } from "../controllers/controller";
import type { ChartDOMAdapter } from "../ui/chart-dom-adapter";
import type { FinancialChart } from "./financial-chart";
import type { Formatter } from "./formatter";
import type { ChartTheme, ResolvedChartTheme } from "./themes";
import type { TimeRange } from "./types";

type DeepReadonly<T> = T extends Function
  ? T
  : T extends object
    ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
    : T;

export type ControllerID =
  | "area"
  | "line"
  | "candle"
  | "bar"
  | "hollow-candle"
  | "stepline"
  | "hlc-area";
export type ControllerType = ControllerID | (string & {});

export interface LocaleValues {
  common: {
    sources: {
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    };
  };
  indicators: {
    actions: {
      show: string;
      hide: string;
      settings: string;
      remove: string;
    };
  };
}

export type LocaleValuesMap = {
  [key: string]: LocaleValues;
};

export interface ChartLocalizationOptions {
  locale?: string;
  timeZone?: string;
  formatter?: Formatter;
  localeValues?: LocaleValuesMap;
}

/** Runtime options accepted by `FinancialChart.updateOptions()`. */
export interface ChartOptionsUpdate extends ChartLocalizationOptions {
  type?: ControllerType;
  timeRange?: TimeRange | "auto";
  stepSize?: number;
  maxZoom?: number;
  volume?: boolean;
  theme?: ChartTheme;
}

export type ChartOptionKey = keyof ChartOptionsUpdate;

export interface ControllerConstructor {
  new (
    chart: FinancialChart,
    options: ResolvedChartOptions
  ): ChartController;
  readonly ID: string;
}

export interface ChartOptions {
  type?: ControllerType;
  timeRange?: TimeRange | "auto";
  stepSize: number;
  maxZoom?: number;
  volume?: boolean;
  controllers?: readonly ControllerConstructor[];
  /**
   * Controls registration of class-provided defaults. Use the core entry to
   * exclude unused controllers from application bundles.
   */
  includeDefaultControllers?: boolean;
  locale?: string;
  timeZone?: string;
  formatter?: Formatter;
  theme?: ChartTheme;
  domAdapter?: ChartDOMAdapter;
  localeValues?: LocaleValuesMap;
}

/** Fully resolved options supplied to controller instances. */
export interface ResolvedChartOptions {
  readonly type: ControllerType;
  readonly timeRange: TimeRange | "auto";
  readonly stepSize: number;
  readonly maxZoom: number;
  readonly volume: boolean;
  readonly controllers: readonly ControllerConstructor[];
  readonly includeDefaultControllers: boolean;
  readonly locale: string;
  readonly timeZone?: string;
  readonly formatter: Formatter;
  readonly theme: ResolvedChartTheme;
  readonly domAdapter: ChartDOMAdapter;
  readonly localeValues: LocaleValuesMap;
}

/** Immutable public snapshot returned by `FinancialChart.getOptions()`. */
export interface ChartOptionsSnapshot {
  readonly type: ControllerType;
  readonly timeRange: DeepReadonly<TimeRange> | "auto";
  readonly stepSize: number;
  readonly maxZoom: number;
  readonly volume: boolean;
  readonly controllers: readonly ControllerConstructor[];
  readonly includeDefaultControllers: boolean;
  readonly locale: string;
  readonly timeZone?: string;
  readonly formatter: Formatter;
  readonly theme: DeepReadonly<ResolvedChartTheme>;
  readonly domAdapter: ChartDOMAdapter;
  readonly localeValues: DeepReadonly<LocaleValuesMap>;
}

export interface ChartOptionsChangeEvent {
  readonly previous: ChartOptionsSnapshot;
  readonly current: ChartOptionsSnapshot;
  readonly changedKeys: readonly ChartOptionKey[];
}

export type MutableResolvedChartOptions = {
  -readonly [P in keyof ResolvedChartOptions]: ResolvedChartOptions[P];
};
