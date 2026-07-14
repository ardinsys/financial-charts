import {
  DefaultDOMAdapter,
  Drawing,
  Indicator,
  type ChartDOMAdapter,
  type ChartPlugin,
  type DefaultIndicatorOptions,
  type DrawingHitTestContext,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext,
  type IndicatorLabelContent,
  type PriceAxisAnnotation
} from "@ardinsys/financial-charts/extensions";

class ExtensionIndicator extends Indicator<{}, DefaultIndicatorOptions> {
  getDefaultOptions(): DefaultIndicatorOptions {
    return { labelKey: "extension", names: { default: "Extension" } };
  }

  getDefaultThemes(): Record<string, {}> {
    return {};
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
  attach() {}
} satisfies ChartPlugin;
const adapter: ChartDOMAdapter = new DefaultDOMAdapter();
const annotation: PriceAxisAnnotation = { id: "fixture", value: 1 };

void [ExtensionIndicator, ExtensionDrawing, plugin, adapter, annotation];
