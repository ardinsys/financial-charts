import type {
  ChartController,
  ChartControllerContext
} from "../controllers/controller";
import type { ChartDOMAdapter } from "../ui/chart-dom-adapter";
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
    context: ChartControllerContext,
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

/** Readonly public snapshot returned by `FinancialChart.getOptions()`. */
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

export function cloneOptionValue<T>(value: T): T {
  return structuredClone(value);
}

export function assertTimeRangeOption(timeRange: TimeRange | "auto"): void {
  if (timeRange === "auto") return;
  if (
    !Number.isFinite(timeRange.start) ||
    !Number.isFinite(timeRange.end) ||
    timeRange.end < timeRange.start
  ) {
    throw new RangeError(
      "timeRange must contain finite values with end greater than or equal to start."
    );
  }
}

export function assertPositiveOption(
  name: "stepSize" | "maxZoom",
  value: number
): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite number greater than zero.`);
  }
}

export function timeRangeOptionsEqual(
  left: TimeRange | "auto",
  right: TimeRange | "auto"
): boolean {
  if (left === "auto" || right === "auto") return left === right;
  return left.start === right.start && left.end === right.end;
}

export function optionValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (
    left === null ||
    right === null ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightRecord, key) &&
      optionValuesEqual(leftRecord[key], rightRecord[key])
  );
}
