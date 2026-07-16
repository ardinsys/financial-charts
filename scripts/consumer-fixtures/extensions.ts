import {
  DefaultDOMAdapter,
  Drawing,
  Indicator,
  type ChartDOMAdapter,
  type ChartCanvasLayer,
  type ChartPlugin,
  type ChartRedrawPart,
  type DefaultIndicatorOptions,
  type DrawingHitTestContext,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext,
  type ExtensionThemeDefaults,
  type IndicatorLabelContent,
  type PriceAxisAnnotation
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
      ctx.getIndicators()
    ];
  }
} satisfies ChartPlugin;
const adapter: ChartDOMAdapter = new DefaultDOMAdapter();
const annotation: PriceAxisAnnotation = { id: "fixture", value: 1 };
const canvasLayer: ChartCanvasLayer = "main";
const redrawPart: ChartRedrawPart = "series";

void [
  ExtensionIndicator,
  ExtensionDrawing,
  plugin,
  adapter,
  annotation,
  canvasLayer,
  redrawPart
];
