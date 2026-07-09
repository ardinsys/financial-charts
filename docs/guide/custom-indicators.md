# Custom indicators

Indicators are chart plugins with a small authoring surface. Use `Indicator` for overlays drawn on the price chart, and `PaneledIndicator` when the indicator needs its own pane, Y axis, and resizable height.

## Overlay indicator

Overlay indicators draw on the shared indicator canvas. The base class handles attachment, labels, actions, visibility, theme merging, and redraw requests.

```ts
import {
  Indicator,
  type ChartData,
  type DefaultIndicatorOptions,
  type IndicatorDrawingContext,
  type IndicatorLabelContent
} from "@ardinsys/financial-charts";

type PriceSource = "open" | "high" | "low" | "close";

interface LastPriceTheme {
  color: string;
  lineWidth: number;
}

interface LastPriceOptions extends DefaultIndicatorOptions {
  source: PriceSource;
}

class LastPriceIndicator extends Indicator<LastPriceTheme, LastPriceOptions> {
  private values = new Map<number, number>();

  public getDefaultOptions(): LastPriceOptions {
    return {
      key: "last-price",
      names: { default: "Last price" },
      source: "close"
    };
  }

  public getDefaultThemes(): Record<string, LastPriceTheme> {
    return {
      light: { color: "#2563eb", lineWidth: 2 },
      dark: { color: "#93c5fd", lineWidth: 2 }
    };
  }

  protected getLabelContent(dataTime?: number): IndicatorLabelContent {
    const sourceName =
      this.chart.getLocaleValues().common.sources[this.options.source];
    const value =
      dataTime === undefined ? undefined : this.values.get(dataTime);

    return {
      detail: sourceName,
      segments:
        value === undefined
          ? []
          : [
              {
                text: this.chart.getFormatter().formatPrice(value),
                color: this.theme.color
              }
            ]
    };
  }

  public draw(): void {
    const context = this.getDrawingContext();
    const points = this.collectVisibleValues(context);
    if (!context.visible || points.length === 0) return;

    const first = points[0];
    const last = points.at(-1)!;
    const start = context.projectPoint(first.time, last.value);
    const end = context.projectPoint(last.time, last.value);

    context.ctx.save();
    context.ctx.strokeStyle = this.theme.color;
    context.ctx.lineWidth = this.theme.lineWidth;
    context.ctx.beginPath();
    context.ctx.moveTo(start.x, start.y);
    context.ctx.lineTo(end.x, end.y);
    context.ctx.stroke();
    context.ctx.restore();
  }

  private collectVisibleValues(context: IndicatorDrawingContext) {
    this.values.clear();

    return context.visibleData.flatMap((point: ChartData) => {
      const value = point[this.options.source];
      if (value == null) return [];
      this.values.set(point.time, value);
      return [{ time: point.time, value }];
    });
  }
}

chart.addIndicator(new LastPriceIndicator());
```

`getDrawingContext()` gives you the canvas context, mapped data, visible data, formatter, theme, visible range, and helpers such as `projectTime`, `projectPrice`, and `projectPoint`. Use those helpers instead of reading canvas dimensions and scales directly.

## Paneled indicator

Paneled indicators get their own pane under the main chart. The chart handles pane layout, divider dragging, canvas sizing, background, grid, Y axis, and label placement. Implement `createScale()`, `drawPane()`, and `getCrosshairValue()`.

```ts
import {
  DataScaleModel,
  PaneledIndicator,
  type ChartData,
  type DefaultIndicatorOptions,
  type IndicatorLabelContent,
  type PaneledIndicatorDrawingContext
} from "@ardinsys/financial-charts";

interface RangePaneTheme {
  color: string;
}

class RangePaneIndicator extends PaneledIndicator<
  RangePaneTheme,
  DefaultIndicatorOptions
> {
  private rangeData: ChartData[] = [];

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      key: "range-pane",
      names: { default: "Range" }
    };
  }

  public getDefaultThemes(): Record<string, RangePaneTheme> {
    return {
      light: { color: "#7c3aed" },
      dark: { color: "#c4b5fd" }
    };
  }

  public createScale(): DataScaleModel {
    this.rangeData = this.toRangeData(this.chart.getData());
    return this.createRangeScale();
  }

  public onData(data: readonly ChartData[]): void {
    this.rangeData = this.toRangeData(data);
    this.scale = this.createRangeScale();
  }

  protected getLabelContent(): IndicatorLabelContent {
    return { detail: "high - low" };
  }

  protected drawPane(context: PaneledIndicatorDrawingContext): void {
    context.ctx.save();
    context.ctx.strokeStyle = this.theme.color;
    context.ctx.lineWidth = 2;
    context.ctx.beginPath();

    this.rangeData.forEach((point, index) => {
      const { x, y } = context.projectPoint(point.time, point.close ?? 0);
      if (index === 0) {
        context.ctx.moveTo(x, y);
      } else {
        context.ctx.lineTo(x, y);
      }
    });

    context.ctx.stroke();
    context.ctx.restore();
  }

  public getCrosshairValue(time: number): string {
    const point = this.rangeData.find((item) => item.time === time);
    return point?.close == null
      ? ""
      : this.chart.getFormatter().formatPrice(point.close);
  }

  private createRangeScale() {
    const data =
      this.rangeData.length > 0 ? this.rangeData : [{ time: 0, close: 0 }];

    return new DataScaleModel("simple", data, this.chart.getVisibleTimeRange());
  }

  private toRangeData(data: readonly ChartData[]): ChartData[] {
    return data.map((point) => ({
      time: point.time,
      close:
        point.high == null || point.low == null ? null : point.high - point.low
    }));
  }
}

chart.addIndicator(new RangePaneIndicator());
```

## Runtime updates

Indicators can expose their own options and let the base class request the right redraw:

```ts
const indicator = new LastPriceIndicator(null, { source: "high" });
chart.addIndicator(indicator);

indicator.updateOptions({ source: "close" });
```

The label is rebuilt from `getLabelContent()` when options, locale, theme, or crosshair state changes. If an indicator should affect auto-scaling, override `getModifier(visibleTimeRange)` and return a `ScaleRangeModifier`.
