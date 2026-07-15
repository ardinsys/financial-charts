import type { ChartModel } from "../chart/chart-model";
import type { ChartOptionsSnapshot } from "../chart/chart-options";
import type { ChartOptionsState } from "../chart/chart-options-state";
import type { ChartData, TimeRange } from "../chart/types";
import type { Pane } from "../panes/pane";
import type { PaneLayout } from "../panes/pane-layout";

export class ChartExtensionReadModel {
  constructor(
    private readonly model: ChartModel,
    private readonly options: ChartOptionsState,
    private readonly panes: PaneLayout
  ) {}

  getData(): readonly ChartData[] {
    return this.model.getData();
  }

  getOptions(): ChartOptionsSnapshot {
    return this.options.getSnapshot();
  }

  getPanes(): readonly Pane[] {
    return this.panes.getPanes();
  }

  getVisibleTimeRange(): TimeRange {
    return this.model.getVisibleTimeRange(this.options.getSnapshot().stepSize);
  }

  getVisibleTimeWindow(): TimeRange {
    return this.model.getVisibleTimeWindow(
      this.options.getSnapshot().stepSize,
      this.model.getBarAlignment()
    );
  }
}
