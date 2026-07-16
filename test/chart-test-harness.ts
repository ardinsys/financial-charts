import type { Pane } from "../src/panes/pane";
import type { PaneLayout } from "../src/panes/pane-layout";
import type { ChartModel } from "../src/chart/chart-model";

export function getChartModel(chart: object): ChartModel {
  return (chart as { model: ChartModel }).model;
}

export function getPaneLayout(chart: object): PaneLayout {
  return (chart as { paneLayout: PaneLayout }).paneLayout;
}

export function getInternalPanes(chart: object): readonly Pane[] {
  return getPaneLayout(chart).getPanes();
}

export function getInternalMainPane(chart: object): Pane {
  return getPaneLayout(chart).getMainPane();
}
