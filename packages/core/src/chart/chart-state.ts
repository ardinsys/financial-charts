import {
  validateIndicatorState,
  type IndicatorResolver,
  type IndicatorState,
  type IndicatorStateValue,
} from "../indicators/indicator";
import { cloneJSONStateValue, isPlainRecord } from "../utils/json-state";
import type { ControllerType } from "./chart-options";
import type { TimeRange } from "./types";

export const CHART_STATE_VERSION = 2 as const;

/** Runtime chart options that affect data mapping and the primary series. */
export interface ChartCoreState {
  readonly type: ControllerType;
  readonly timeRange: TimeRange | "auto";
  readonly stepSize: number;
  readonly maxZoom: number;
  readonly volume: boolean;
}

export interface ChartPaneState {
  /** Stable pane identity used by drawings and other pane-owned state. */
  readonly id: number;
  /** Share of the available pane layout height, normalized across all panes. */
  readonly heightRatio: number;
  /** The paneled indicator that owns this pane; absent for the main pane. */
  readonly indicatorInstanceId?: string;
}

/** Versioned, JSON-safe chart configuration and view state. */
export interface ChartState {
  readonly version: typeof CHART_STATE_VERSION;
  readonly core: ChartCoreState;
  readonly visibleRange: TimeRange;
  readonly panes: readonly ChartPaneState[];
  readonly indicators: readonly IndicatorState[];
  readonly contributions?: Readonly<Record<string, IndicatorStateValue>>;
}

export interface ChartStateContributor<TState = unknown> {
  /** Unique persistence key stored under `ChartState.contributions`. */
  readonly key: string;
  toJSON(): TState;
  /** Restores persisted state, or resets runtime state when the key is absent. */
  fromJSON(state: TState | undefined): unknown;
}

export interface ChartStateSerializationOptions {
  contributors?: readonly ChartStateContributor[];
}

export interface ChartStateRestoreOptions extends ChartStateSerializationOptions {
  indicatorResolver?: IndicatorResolver;
}

export interface ChartStateRestoredEvent {
  /** Final normalized state after all contributors have been restored. */
  readonly state: ChartState;
}

type ChartStateSnapshot = Omit<ChartState, "version" | "contributions">;

export function createChartState(
  snapshot: ChartStateSnapshot,
  contributors: readonly ChartStateContributor[]
): ChartState {
  const contributorMap = indexStateContributors(contributors);
  const contributions: Record<string, IndicatorStateValue> = {};
  for (const [key, contributor] of contributorMap) {
    contributions[key] = cloneJSONStateValue(
      contributor.toJSON(),
      `Chart state contribution "${key}"`
    );
  }

  return {
    version: CHART_STATE_VERSION,
    ...snapshot,
    ...(Object.keys(contributions).length > 0 ? { contributions } : {}),
  };
}

export function indexStateContributors(
  contributors: readonly ChartStateContributor[]
): Map<string, ChartStateContributor> {
  const indexed = new Map<string, ChartStateContributor>();
  for (const contributor of contributors) {
    if (typeof contributor.key !== "string" || contributor.key.length === 0) {
      throw new Error("Chart state contributors must have a non-empty key.");
    }
    if (indexed.has(contributor.key)) {
      throw new Error(
        `Duplicate chart state contributor key "${contributor.key}".`
      );
    }
    indexed.set(contributor.key, contributor);
  }
  return indexed;
}

export function validateChartState(state: unknown): ChartState {
  if (!isPlainRecord(state)) {
    throw new Error("Invalid chart state: expected an object.");
  }
  if (!("version" in state) || typeof state.version !== "number") {
    throw new Error("Invalid chart state: version must be a number.");
  }
  if (state.version !== CHART_STATE_VERSION) {
    throw new Error(
      `Unsupported chart state version "${state.version}"; expected ${CHART_STATE_VERSION}.`
    );
  }
  if (!isPlainRecord(state.core)) {
    throw new Error("Invalid chart state: core must be an object.");
  }
  if (typeof state.core.type !== "string" || state.core.type.length === 0) {
    throw new Error("Invalid chart state: core.type must not be empty.");
  }
  const timeRange = validateChartStateTimeRange(
    state.core.timeRange,
    "core.timeRange",
    true
  );
  if (
    typeof state.core.stepSize !== "number" ||
    !Number.isFinite(state.core.stepSize) ||
    state.core.stepSize <= 0
  ) {
    throw new Error("Invalid chart state: core.stepSize must be positive.");
  }
  if (
    typeof state.core.maxZoom !== "number" ||
    !Number.isFinite(state.core.maxZoom) ||
    state.core.maxZoom <= 0
  ) {
    throw new Error("Invalid chart state: core.maxZoom must be positive.");
  }
  if (typeof state.core.volume !== "boolean") {
    throw new Error("Invalid chart state: core.volume must be a boolean.");
  }

  const visibleRange = validateChartStateTimeRange(
    state.visibleRange,
    "visibleRange",
    false
  ) as TimeRange;
  if (visibleRange.end <= visibleRange.start) {
    throw new Error(
      "Invalid chart state: visibleRange.end must be greater than start."
    );
  }
  if (!Array.isArray(state.panes) || state.panes.length === 0) {
    throw new Error("Invalid chart state: panes must be a non-empty array.");
  }
  const paneIds = new Set<number>();
  const panes = state.panes.map((pane, index): ChartPaneState => {
    if (!isPlainRecord(pane)) {
      throw new Error(
        `Invalid chart state: panes[${index}] must be an object.`
      );
    }
    if (!Number.isInteger(pane.id) || (pane.id as number) < 0) {
      throw new Error(
        `Invalid chart state: panes[${index}].id must be a non-negative integer.`
      );
    }
    if (paneIds.has(pane.id as number)) {
      throw new Error(`Chart state contains duplicate pane id "${pane.id}".`);
    }
    paneIds.add(pane.id as number);
    if (
      typeof pane.heightRatio !== "number" ||
      !Number.isFinite(pane.heightRatio) ||
      pane.heightRatio < 0 ||
      pane.heightRatio > 1
    ) {
      throw new Error(
        `Invalid chart state: panes[${index}].heightRatio must be between 0 and 1.`
      );
    }
    if (
      pane.indicatorInstanceId !== undefined &&
      (typeof pane.indicatorInstanceId !== "string" ||
        pane.indicatorInstanceId.length === 0)
    ) {
      throw new Error(
        `Invalid chart state: panes[${index}].indicatorInstanceId must not be empty.`
      );
    }
    return {
      id: pane.id as number,
      heightRatio: pane.heightRatio,
      ...(pane.indicatorInstanceId === undefined
        ? {}
        : { indicatorInstanceId: pane.indicatorInstanceId }),
    };
  });
  const paneHeightRatioTotal = panes.reduce(
    (sum, pane) => sum + pane.heightRatio,
    0
  );
  if (Math.abs(paneHeightRatioTotal - 1) > 1e-6) {
    throw new Error(
      "Invalid chart state: pane heightRatio values must sum to 1."
    );
  }

  if (!Array.isArray(state.indicators)) {
    throw new Error("Invalid chart state: indicators must be an array.");
  }
  const indicators = state.indicators.map((indicator) =>
    validateIndicatorState(indicator)
  );

  let contributions: Record<string, IndicatorStateValue> | undefined;
  if (state.contributions !== undefined) {
    if (!isPlainRecord(state.contributions)) {
      throw new Error("Invalid chart state: contributions must be an object.");
    }
    contributions = {};
    for (const [key, value] of Object.entries(state.contributions)) {
      contributions[key] = cloneJSONStateValue(
        value,
        `Chart state contribution "${key}"`
      );
    }
  }

  return {
    version: CHART_STATE_VERSION,
    core: {
      type: state.core.type,
      timeRange,
      stepSize: state.core.stepSize,
      maxZoom: state.core.maxZoom,
      volume: state.core.volume,
    },
    visibleRange,
    panes,
    indicators,
    ...(contributions ? { contributions } : {}),
  };
}

function validateChartStateTimeRange(
  value: unknown,
  path: string,
  allowAuto: true
): TimeRange | "auto";
function validateChartStateTimeRange(
  value: unknown,
  path: string,
  allowAuto: false
): TimeRange;
function validateChartStateTimeRange(
  value: unknown,
  path: string,
  allowAuto: boolean
): TimeRange | "auto" {
  if (allowAuto && value === "auto") return value;
  if (
    !isPlainRecord(value) ||
    typeof value.start !== "number" ||
    !Number.isFinite(value.start) ||
    typeof value.end !== "number" ||
    !Number.isFinite(value.end) ||
    value.end < value.start
  ) {
    throw new Error(
      `Invalid chart state: ${path} must contain finite start and end values.`
    );
  }
  return { start: value.start, end: value.end };
}
