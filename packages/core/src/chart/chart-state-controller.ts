import {
  restoreValidatedIndicator,
  type Indicator
} from "../indicators/indicator";
import { PaneledIndicator } from "../indicators/paneled-indicator";
import {
  createChartState,
  indexStateContributors,
  validateChartState,
  type ChartState,
  type ChartStateContributor,
  type ChartStateRestoreOptions,
  type ChartStateSerializationOptions
} from "./chart-state";
import type { TimeRange } from "./types";

type ChartStateSnapshot = Omit<ChartState, "version" | "contributions">;

export interface ChartStateRuntimeSnapshot {
  readonly state: ChartStateSnapshot;
  readonly mainPaneId: number;
  readonly controllerTypes: readonly string[];
}

export interface PreparedChartStateRestoration {
  readonly state: ChartState;
  readonly indicators: readonly Indicator<any, any>[];
  readonly paneIdsByIndicator: ReadonlyMap<string, number>;
  readonly contributors: readonly ChartStateContributor[];
}

export class ChartStateController {
  private pendingVisibleRange?: TimeRange;

  constructor(
    private readonly capture: () => ChartStateRuntimeSnapshot,
    private readonly applyRestoration: (
      restoration: PreparedChartStateRestoration
    ) => boolean,
    private readonly applyVisibleRange: (range: TimeRange) => boolean
  ) {}

  toJSON(options: ChartStateSerializationOptions = {}): ChartState {
    const snapshot = this.capture().state;
    return createChartState(
      {
        ...snapshot,
        visibleRange: {
          ...(this.pendingVisibleRange ?? snapshot.visibleRange)
        }
      },
      options.contributors ?? []
    );
  }

  restore(
    state: unknown,
    options: ChartStateRestoreOptions = {}
  ): ChartState {
    const validatedState = validateChartState(state);
    const runtime = this.capture();
    if (!runtime.controllerTypes.includes(validatedState.core.type)) {
      throw new Error(
        `Controller: ${validatedState.core.type} is not registered!`
      );
    }

    if (validatedState.indicators.length > 0 && !options.indicatorResolver) {
      throw new Error(
        "Chart state contains indicators but no indicatorResolver was provided."
      );
    }
    const restoredIndicators = validatedState.indicators.map((indicatorState) =>
      restoreValidatedIndicator(indicatorState, options.indicatorResolver!)
    );
    this.validateIndicatorIds(restoredIndicators);

    const paneIdsByIndicator = this.validatePanes(
      validatedState,
      restoredIndicators,
      runtime.mainPaneId
    );
    const contributors = this.resolveContributors(
      validatedState,
      indexStateContributors(options.contributors ?? [])
    );

    const visibleRangeDeferred = this.applyRestoration({
      state: validatedState,
      indicators: restoredIndicators,
      paneIdsByIndicator,
      contributors
    });
    this.pendingVisibleRange = visibleRangeDeferred
      ? validatedState.visibleRange
      : undefined;

    return this.toJSON({ contributors });
  }

  applyPendingVisibleRange(): boolean {
    if (!this.pendingVisibleRange) return false;

    const changed = this.applyVisibleRange(this.pendingVisibleRange);
    this.pendingVisibleRange = undefined;
    return changed;
  }

  private validateIndicatorIds(
    indicators: readonly Indicator<any, any>[]
  ): void {
    const instanceIds = new Set<string>();
    for (const indicator of indicators) {
      const instanceId = indicator.getInstanceId();
      if (instanceIds.has(instanceId)) {
        throw new Error(
          `Chart state contains duplicate indicator instanceId "${instanceId}".`
        );
      }
      instanceIds.add(instanceId);
    }
  }

  private validatePanes(
    state: ChartState,
    indicators: readonly Indicator<any, any>[],
    mainPaneId: number
  ): ReadonlyMap<string, number> {
    const paneIdsByIndicator = new Map<string, number>();
    const indicatorsById = new Map(
      indicators.map((indicator) => [indicator.getInstanceId(), indicator])
    );
    let hasMainPane = false;

    for (const pane of state.panes) {
      if (pane.indicatorInstanceId === undefined) {
        if (pane.id !== mainPaneId || hasMainPane) {
          throw new Error("Chart state must contain exactly one main pane.");
        }
        hasMainPane = true;
        continue;
      }

      const indicator = indicatorsById.get(pane.indicatorInstanceId);
      if (!indicator) {
        throw new Error(
          `Chart pane ${pane.id} references unknown indicator "${pane.indicatorInstanceId}".`
        );
      }
      if (!(indicator instanceof PaneledIndicator)) {
        throw new Error(
          `Chart pane ${pane.id} references overlay indicator "${pane.indicatorInstanceId}".`
        );
      }
      if (paneIdsByIndicator.has(pane.indicatorInstanceId)) {
        throw new Error(
          `Chart state contains multiple panes for indicator "${pane.indicatorInstanceId}".`
        );
      }
      paneIdsByIndicator.set(pane.indicatorInstanceId, pane.id);
    }

    if (!hasMainPane) {
      throw new Error("Chart state must contain exactly one main pane.");
    }
    for (const indicator of indicators) {
      const instanceId = indicator.getInstanceId();
      if (
        indicator instanceof PaneledIndicator &&
        !paneIdsByIndicator.has(instanceId)
      ) {
        throw new Error(
          `Chart state has no pane for indicator "${instanceId}".`
        );
      }
    }
    return paneIdsByIndicator;
  }

  private resolveContributors(
    state: ChartState,
    contributors: ReadonlyMap<string, ChartStateContributor>
  ): ChartStateContributor[] {
    for (const key of Object.keys(state.contributions ?? {})) {
      if (!contributors.has(key)) {
        throw new Error(
          `Chart state contribution "${key}" has no matching contributor.`
        );
      }
    }
    return [...contributors.values()];
  }
}
