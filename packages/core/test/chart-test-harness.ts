import type { Pane } from "../src/panes/pane";
import type { PaneLayout } from "../src/panes/pane-layout";
import type { ChartModel } from "../src/chart/chart-model";
import type { ChartRenderer } from "../src/render/chart-renderer";
import type {
  ChartCanvasLayer,
  ChartRedrawPart,
} from "../src/render/chart-render-types";
import type { ExtensionHost } from "../src/plugin/extension-host";

export function getChartModel(chart: object): ChartModel {
  return (chart as { model: ChartModel }).model;
}

export function getPaneLayout(chart: object): PaneLayout {
  return (chart as { paneLayout: PaneLayout }).paneLayout;
}

export function getChartRenderer(chart: object): ChartRenderer {
  return (chart as { renderer: ChartRenderer }).renderer;
}

export function getExtensionHost(chart: object): ExtensionHost {
  return (chart as { extensionHost: ExtensionHost }).extensionHost;
}

export function getChartContext(
  chart: object,
  layer: ChartCanvasLayer
): CanvasRenderingContext2D {
  return getChartRenderer(chart).getContext(layer);
}

export function requestChartRedraw(
  chart: object,
  part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>,
  immediate = false
): void {
  getChartRenderer(chart).requestRedraw(part, immediate);
}

export function getInternalPanes(chart: object): readonly Pane[] {
  return getPaneLayout(chart).getPanes();
}

export function getInternalMainPane(chart: object): Pane {
  return getPaneLayout(chart).getMainPane();
}
