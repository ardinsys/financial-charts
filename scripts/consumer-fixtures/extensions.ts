import {
  Drawing,
  Indicator,
  type BarAlignment,
  type ChartCrosshairOptions,
  type ChartCrosshairState,
  type ChartData,
  type ChartDOMAdapter,
  type ChartCanvasLayer,
  type ChartEventMap,
  type ChartOptionsChangeEvent,
  type ChartOptionsSnapshot,
  type ChartPaneState,
  type ChartPlugin,
  type ChartRedrawPart,
  type DrawingEvent,
  type DefaultIndicatorOptions,
  type DrawingHitTestContext,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext,
  type ExtensionThemeDefaults,
  type Formatter,
  type IndicatorLabelContent,
  type IndicatorEvent,
  type IndicatorVisibilityChangedEvent,
  type LocaleValues,
  type PriceAxisAnnotation,
  type RenderCallback,
  type RenderStage,
  type ScaleRangeModifier,
  type TimeRange,
  type TimeScaleRange
} from "@ardinsys/financial-charts/extensions";

class ExtensionIndicator extends Indicator<{}, DefaultIndicatorOptions> {
  getDefaultOptions(): DefaultIndicatorOptions {
    return { labelKey: "extension", names: { default: "Extension" } };
  }

  getDefaultThemes(): ExtensionThemeDefaults<{}> {
    return { light: {}, dark: {} };
  }

  protected getLabelContent(): IndicatorLabelContent {
    return {};
  }

  draw(): void {}
}

class ExtensionDrawing extends Drawing {
  readonly type = "extension-drawing";

  constructor(options: DrawingOptions) {
    super(options);
  }

  draw(_ctx: CanvasRenderingContext2D, _context: DrawingRenderContext): void {}

  hitTest(_point: DrawingPoint, _context: DrawingHitTestContext): boolean {
    return false;
  }
}

const plugin = {
  key: "extension-fixture",
  attach(ctx) {
    // @ts-expect-error Plugin contexts do not expose the application facade.
    ctx.chart;
    void [
      ctx.getData(),
      ctx.getOptions(),
      ctx.hostElement,
      ctx.getCrosshairState(),
      ctx.getIndicators(),
      ctx.getVisibleLogicalRange()
    ];
  }
} satisfies ChartPlugin;
const adapter = {} as ChartDOMAdapter;
const annotation: PriceAxisAnnotation = { id: "fixture", value: 1 };
const canvasLayer: ChartCanvasLayer = "main";
const redrawPart: ChartRedrawPart = "series";
type AuthoringContracts = [
  BarAlignment,
  ChartCrosshairOptions,
  ChartCrosshairState,
  ChartData,
  ChartEventMap,
  ChartOptionsChangeEvent,
  ChartOptionsSnapshot,
  ChartPaneState,
  DrawingEvent,
  Formatter,
  IndicatorEvent,
  IndicatorVisibilityChangedEvent,
  LocaleValues,
  RenderCallback,
  RenderStage,
  ScaleRangeModifier,
  TimeRange,
  TimeScaleRange
];

void [
  ExtensionIndicator,
  ExtensionDrawing,
  plugin,
  adapter,
  annotation,
  canvasLayer,
  redrawPart,
  null as unknown as AuthoringContracts
];
