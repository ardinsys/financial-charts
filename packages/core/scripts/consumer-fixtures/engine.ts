import {
  DataScaleModel,
  Pane,
  PaneledIndicator,
  RenderPipeline,
  TimeTickGenerator,
  calculateYAxisLabels,
  createCanvasLayer,
  type ChartCanvasLayer,
  type DefaultIndicatorOptions,
  type ExtensionThemeDefaults,
  type Formatter,
  type PaneledIndicatorDrawingContext,
  paletteColor
} from "@ardinsys/financial-charts/engine";

class ExtensionPane extends PaneledIndicator<{}, DefaultIndicatorOptions> {
  getDefaultOptions(): DefaultIndicatorOptions {
    return { labelKey: "pane", names: { default: "Pane" } };
  }

  getDefaultThemes(): ExtensionThemeDefaults<{}> {
    return { light: {}, dark: {} };
  }

  createScale(): DataScaleModel {
    return new DataScaleModel("simple", [], { start: 0, end: 1 });
  }

  getCrosshairValue(): string {
    return "";
  }

  protected getLabelContent() {
    return {};
  }

  protected drawPane(_context: PaneledIndicatorDrawingContext): void {}
}

const formatter = {} as Formatter;
const ticks = new TimeTickGenerator().generate({
  times: [],
  visibleRange: { from: 0, to: 0 },
  formatter
});
const color = paletteColor(["#0af", "#f80"], 3);
const canvasLayer: ChartCanvasLayer = "main";

void [
  ExtensionPane,
  Pane,
  RenderPipeline,
  TimeTickGenerator,
  calculateYAxisLabels,
  createCanvasLayer,
  ticks,
  color,
  canvasLayer
];
