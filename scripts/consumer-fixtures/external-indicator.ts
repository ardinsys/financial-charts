import type { TimeRange } from "@ardinsys/financial-charts";
import {
  Indicator,
  type IndicatorContext,
  type ChartPointerEvent,
  type DefaultIndicatorOptions,
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
    themes?: Record<string, Partial<OrdersTheme>> | null,
    options?: IndicatorOptionsInput<OrdersOptions> | null
  ) {
    super(themes, options);
  }

  override attach(ctx: IndicatorContext): void {
    super.attach(ctx);
    // @ts-expect-error Indicators cannot issue application commands.
    ctx.chart;
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

  getDefaultThemes(): Record<string, OrdersTheme> {
    return {
      light: { buyColor: "#00897b", sellColor: "#d81b60" },
      dark: { buyColor: "#4db6ac", sellColor: "#f06292" }
    };
  }

  draw(): void {
    const context = this.getDrawingContext();
    // @ts-expect-error Drawing snapshots expose projections, not mutable scales.
    context.visibleScale;
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

declare const orderSource: OrderSource;
const indicator = new OrdersIndicator(orderSource);

void indicator;
