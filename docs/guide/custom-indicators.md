# Custom indicators

Indicators are chart extensions with a focused `IndicatorContext`. Use
`Indicator` for overlays drawn on the price chart, and `PaneledIndicator` when
the indicator needs its own pane, Y axis, and resizable height.

## Overlay indicator

Overlay indicators draw on the shared indicator canvas. The base class handles attachment, labels, actions, visibility, theme merging, and redraw requests.

```ts
import {
  Indicator,
  type DefaultIndicatorOptions,
  type ExtensionThemeDefaults,
  type IndicatorDrawingContext,
  type IndicatorLabelContent
} from "@ardinsys/financial-charts/extensions";
import type { ChartData } from "@ardinsys/financial-charts";

type PriceSource = "open" | "high" | "low" | "close";

interface LastPriceTheme {
  color: string;
  lineWidth: number;
}

interface LastPriceOptions extends DefaultIndicatorOptions {
  source: PriceSource;
}

class LastPriceIndicator extends Indicator<LastPriceTheme, LastPriceOptions> {
  static readonly ID = "last-price";

  private values = new Map<number, number>();

  public getDefaultOptions(): LastPriceOptions {
    return {
      labelKey: "last-price",
      names: { default: "Last price" },
      source: "close"
    };
  }

  public getDefaultThemes(): ExtensionThemeDefaults<LastPriceTheme> {
    return {
      light: { color: "#2563eb", lineWidth: 2 },
      dark: { color: "#93c5fd", lineWidth: 2 }
    };
  }

  protected getLabelContent(dataTime?: number): IndicatorLabelContent {
    const sourceName =
      this.indicatorContext.getLocaleValues().common.sources[
        this.options.source
      ];
    const value =
      dataTime === undefined ? undefined : this.values.get(dataTime);

    return {
      detail: sourceName,
      segments:
        value === undefined
          ? []
          : [
              {
                text: this.indicatorContext
                  .getOptions()
                  .formatter.formatPrice(value),
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

Indicators use the same `ExtensionThemeResolver` as other visual extensions.
`getDefaultThemes()` supplies complete light and dark fallbacks and may include
additional complete custom-key definitions. Constructor theme maps are deep
partial overrides for base or custom chart theme keys.

`getDrawingContext()` gives you the canvas context, mapped data, visible data, formatter, theme, visible range, and helpers such as `projectTime`, `projectPrice`, and `projectPoint`. Use those helpers instead of reading canvas dimensions and scales directly.

## Paneled indicator

Paneled indicators get their own pane under the main chart. The chart handles pane layout, divider dragging, canvas sizing, background, grid, Y axis, and label placement. Implement `createScale()`, `drawPane()`, and `getCrosshairValue()`.

```ts
import {
  PaneledIndicator,
  type DefaultIndicatorOptions,
  type ExtensionThemeDefaults,
  type IndicatorLabelContent,
  type PaneledIndicatorDrawingContext
} from "@ardinsys/financial-charts/extensions";
import { DataScaleModel } from "@ardinsys/financial-charts/engine";
import type { ChartData, TimeRange } from "@ardinsys/financial-charts";

interface RangePaneTheme {
  color: string;
}

class RangePaneIndicator extends PaneledIndicator<
  RangePaneTheme,
  DefaultIndicatorOptions
> {
  static readonly ID = "range-pane";

  private rangeData: ChartData[] = [];

  public getDefaultOptions(): DefaultIndicatorOptions {
    return {
      labelKey: "range-pane",
      names: { default: "Range" }
    };
  }

  public getDefaultThemes(): ExtensionThemeDefaults<RangePaneTheme> {
    return {
      light: { color: "#7c3aed" },
      dark: { color: "#c4b5fd" }
    };
  }

  public createScale(): DataScaleModel {
    this.rangeData = this.toRangeData(this.indicatorContext.getData());
    return this.createRangeScale();
  }

  public onData(data: readonly ChartData[]): void {
    this.rangeData = this.toRangeData(data);
    this.recalculateScale(this.indicatorContext.getVisibleTimeRange());
  }

  public onVisibleRangeChanged(range: TimeRange): void {
    this.recalculateScale(range);
  }

  protected getLabelContent(): IndicatorLabelContent {
    return { detail: "high - low" };
  }

  protected drawPane(context: PaneledIndicatorDrawingContext): void {
    context.ctx.save();
    context.ctx.strokeStyle = this.theme.color;
    context.ctx.lineWidth = 2;
    context.ctx.beginPath();

    let drawing = false;
    for (const point of this.rangeData) {
      if (
        point.time < context.visibleTimeRange.start ||
        point.time >= context.visibleTimeRange.end ||
        point.close == null
      ) {
        drawing = false;
        continue;
      }
      const { x, y } = context.projectPoint(point.time, point.close);
      if (!drawing) {
        context.ctx.moveTo(x, y);
        drawing = true;
      } else {
        context.ctx.lineTo(x, y);
      }
    }

    context.ctx.stroke();
    context.ctx.restore();
  }

  public getCrosshairValue(time: number): string {
    const point = this.rangeData.find((item) => item.time === time);
    return point?.close == null
      ? ""
      : this.indicatorContext.getOptions().formatter.formatPrice(point.close);
  }

  private createRangeScale() {
    const data =
      this.rangeData.length > 0 ? this.rangeData : [{ time: 0, close: 0 }];

    return new DataScaleModel(
      "simple",
      data,
      this.indicatorContext.getVisibleTimeRange()
    );
  }

  private recalculateScale(range: TimeRange): void {
    const data =
      this.rangeData.length > 0 ? this.rangeData : [{ time: 0, close: 0 }];
    this.scale.recalculate(data, range);
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

Pass `instanceId` when restoring a persisted indicator or when application
state needs a known identity:

```ts
const fast = new LastPriceIndicator(null, { instanceId: "fast-last-price" });
const slow = new LastPriceIndicator(null, { instanceId: "slow-last-price" });

chart.addIndicator(fast);
chart.addIndicator(slow);

chart.getIndicatorById("fast-last-price");
chart.getIndicatorsByType(LastPriceIndicator.ID);
```

The label is rebuilt from `getLabelContent()` when options, locale, theme, or crosshair state changes. If an indicator should affect auto-scaling, override `getModifier(visibleTimeRange)` and return a `ScaleRangeModifier`.

## Persistence

Persist an indicator with `toJSON()` and restore it through an application
resolver. The resolver owns concrete class construction and runtime services;
the chart library owns state validation and applying options, identity, and
visibility:

```ts
import { restoreIndicator } from "@ardinsys/financial-charts";

const state = indicator.toJSON();
localStorage.setItem("indicator", JSON.stringify(state));

const restored = restoreIndicator(
  JSON.parse(localStorage.getItem("indicator")!),
  ({ typeId }) => {
    switch (typeId) {
      case LastPriceIndicator.ID:
        return new LastPriceIndicator();
    }
  }
);

chart.addIndicator(restored);
```

The default state contains regular configurable options but excludes localized
names, label metadata, themes, DOM state, and loaded external data. Override
`serializeStateOptions()` and `restoreStateOptions()` as a pair when an option
shape contains functions or needs a different JSON representation. Runtime
services should stay in constructor fields and must not be serialized.

## Complete external-data indicator

The following Orders indicator is driven by an application service. It uses the
attachment signal for subscription cleanup, projection helpers for markers,
`invalidate()` for external state, a visible-range modifier for auto-scaling,
pointer delivery for hover, and owned price-axis annotations. It does not add a
DOM listener or access an internal chart canvas.

```ts
import type { TimeRange } from "@ardinsys/financial-charts";
import {
  Indicator,
  type IndicatorContext,
  type ChartPointerEvent,
  type DefaultIndicatorOptions,
  type ExtensionThemeDefaults,
  type ExtensionThemeMap,
  type IndicatorLabelContent,
  type IndicatorOptionsInput
} from "@ardinsys/financial-charts/extensions";
import type { ScaleRangeModifier } from "@ardinsys/financial-charts/engine";

interface Order {
  readonly id: string;
  readonly price: number;
  readonly side: "buy" | "sell";
  readonly time: number;
}

interface OrderSource {
  subscribe(
    listener: (orders: readonly Order[]) => void,
    options: { signal: AbortSignal }
  ): void;
}

interface OrdersTheme {
  buyColor: string;
  sellColor: string;
}

type OrdersOptions = DefaultIndicatorOptions;

class OrdersIndicator extends Indicator<OrdersTheme, OrdersOptions> {
  static readonly ID = "orders";

  private hoveredId?: string;
  private orders: readonly Order[] = [];

  constructor(
    private readonly source: OrderSource,
    themes?: ExtensionThemeMap<OrdersTheme> | null,
    options?: IndicatorOptionsInput<OrdersOptions> | null
  ) {
    super(themes, options);
  }

  override attach(ctx: IndicatorContext): void {
    super.attach(ctx);
    this.source.subscribe((orders) => this.setOrders(orders), {
      signal: ctx.signal
    });
  }

  getDefaultOptions(): OrdersOptions {
    return {
      labelKey: "orders",
      names: { default: "Orders" }
    };
  }

  getDefaultThemes(): ExtensionThemeDefaults<OrdersTheme> {
    return {
      light: { buyColor: "#00897b", sellColor: "#d81b60" },
      dark: { buyColor: "#4db6ac", sellColor: "#f06292" }
    };
  }

  draw(): void {
    const context = this.getDrawingContext();
    if (!context.visible) return;

    for (const order of this.getVisibleOrders(context.visibleTimeRange)) {
      const point = context.projectPoint(order.time, order.price);
      const hovered = order.id === this.hoveredId;
      context.ctx.save();
      context.ctx.fillStyle = this.getColor(order);
      context.ctx.beginPath();
      context.ctx.arc(point.x, point.y, hovered ? 6 : 4, 0, Math.PI * 2);
      context.ctx.fill();
      context.ctx.restore();
    }
  }

  getModifier(range: TimeRange): ScaleRangeModifier | null {
    const visible = this.getVisibleOrders(range);
    if (visible.length === 0) return null;
    const prices = visible.map(({ price }) => price);
    return {
      actor: this,
      enabled: true,
      yMin: Math.min(...prices),
      yMax: Math.max(...prices)
    };
  }

  onVisibleRangeChanged(): void {
    this.syncAnnotations();
  }

  onOptionsChanged(): void {
    this.syncAnnotations();
  }

  onPointer(event: ChartPointerEvent): void {
    const hoveredId = this.findHoveredId(event.x, event.y);
    if (hoveredId === this.hoveredId) return;
    this.hoveredId = hoveredId;
    this.syncAnnotations();
    this.invalidate({ crosshair: false });
  }

  override clone(): OrdersIndicator {
    const clone = new OrdersIndicator(this.source, this.themes, this.options);
    clone.setVisible(this.visible, { emit: false });
    return clone;
  }

  protected getLabelContent(): IndicatorLabelContent {
    const hovered = this.orders.find(({ id }) => id === this.hoveredId);
    return {
      detail: `${this.orders.length}`,
      segments: hovered
        ? [
            {
              text: this.indicatorContext
                .getOptions()
                .formatter.formatPrice(hovered.price),
              color: this.getColor(hovered)
            }
          ]
        : []
    };
  }

  private setOrders(orders: readonly Order[]): void {
    this.orders = orders.map((order) => ({ ...order }));
    if (
      this.hoveredId !== undefined &&
      !this.orders.some(({ id }) => id === this.hoveredId)
    ) {
      this.hoveredId = undefined;
    }
    this.invalidate({ scale: true });
    if (this.indicatorContext) this.syncAnnotations();
  }

  private getVisibleOrders(range: TimeRange): readonly Order[] {
    return this.orders.filter(
      ({ time }) => time >= range.start && time < range.end
    );
  }

  private findHoveredId(x: number, y: number): string | undefined {
    const context = this.getDrawingContext();
    return this.getVisibleOrders(context.visibleTimeRange).find((order) => {
      const point = context.projectPoint(order.time, order.price);
      return Math.hypot(point.x - x, point.y - y) <= 8;
    })?.id;
  }

  private syncAnnotations(): void {
    const range = this.indicatorContext.getVisibleTimeRange();
    const paneId = this.indicatorContext.getPanes()[0]?.getId();
    this.indicatorContext.setPriceAxisAnnotations(
      this.getVisibleOrders(range).map((order) => ({
        id: order.id,
        paneId,
        value: order.price,
        text: this.indicatorContext
          .getOptions()
          .formatter.formatPrice(order.price),
        color: this.getColor(order),
        emphasized: order.id === this.hoveredId,
        lineDash: [4, 3]
      }))
    );
  }

  private getColor(order: Order): string {
    return order.side === "buy" ? this.theme.buyColor : this.theme.sellColor;
  }
}
```

`invalidate()` is intentionally safe before attachment and after detachment.
Label, indicator, and crosshair invalidation default to `true`; price-scale
recalculation is opt-in with `{ scale: true }`. Republish annotations when
external data, visible range, hover, locale, or theme changes because each call
replaces this attachment's previous collection.

The source must stop delivery when `signal` aborts. For promise-based loads,
pass the same signal to the request and also keep a monotonically increasing
request version when multiple loads can overlap, so a stale response cannot
replace newer state.

Because the service is a constructor dependency, `clone()` reinjects it while
allowing the base constructor to generate a new instance ID. The application
resolver performs the same injection when restoring persisted chart or
indicator state. Loaded orders remain runtime data and are not serialized.
