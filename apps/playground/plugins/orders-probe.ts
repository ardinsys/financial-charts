import type { ChartData } from "@ardinsys/financial-charts";
import type {
  ChartContext,
  ChartPlugin,
  ChartPointerEvent,
} from "@ardinsys/financial-charts/extensions";

export interface ProbeOrder {
  id: string;
  price: number;
  side: "buy" | "sell";
  time: number;
}

interface OrderPosition {
  order: ProbeOrder;
  visible: boolean;
  x: number;
  y: number;
}

const hoverThreshold = 10;

export class OrdersProbePlugin implements ChartPlugin {
  readonly key = "playground-orders-probe";

  private context?: ChartContext;
  private disposers: Array<() => void> = [];
  private hoveredId?: string;
  private orders: readonly ProbeOrder[];

  constructor(orders: readonly ProbeOrder[]) {
    this.orders = snapshotOrders(orders);
  }

  attach(context: ChartContext): void {
    this.context = context;
    this.disposers = [
      context.onRenderStage("indicators", () => this.drawMarkers()),
      context.on("crosshair-clear", () => this.setHoveredOrder(undefined)),
    ];
    this.syncAnnotations();
  }

  detach(): void {
    this.context?.clearPriceAxisAnnotations();
    for (const dispose of this.disposers.splice(0)) dispose();
    this.context = undefined;
    this.hoveredId = undefined;
  }

  onVisibleRangeChanged(): void {
    this.syncAnnotations();
  }

  onOptionsChanged(): void {
    this.syncAnnotations();
  }

  onPointer(event: ChartPointerEvent): void {
    this.setHoveredOrder(this.findHoveredOrder(event));
  }

  setOrders(orders: readonly ProbeOrder[]): void {
    this.orders = snapshotOrders(orders);
    if (!this.orders.some((order) => order.id === this.hoveredId)) {
      this.hoveredId = undefined;
    }
    this.syncAnnotations();
    this.context?.requestRedraw("indicators");
  }

  private drawMarkers() {
    const context = this.context;
    if (!context) return;

    const canvasContext = context.getCanvasContext("indicator");
    for (const position of this.getPositions()) {
      if (!position.visible) continue;

      const hovered = position.order.id === this.hoveredId;
      const palette = getOrderPalette(position.order.side, hovered);
      canvasContext.save();
      canvasContext.beginPath();
      canvasContext.arc(
        position.x,
        position.y,
        hovered ? 7 : 5,
        0,
        Math.PI * 2
      );
      canvasContext.fillStyle = palette.marker;
      canvasContext.fill();
      canvasContext.strokeStyle = "#ffffff";
      canvasContext.lineWidth = 1.5;
      canvasContext.stroke();
      canvasContext.restore();
    }
  }

  private syncAnnotations() {
    const context = this.context;
    if (!context) return;

    const pane = context.getPanes()[0];
    if (!pane) {
      context.clearPriceAxisAnnotations();
      return;
    }

    context.setPriceAxisAnnotations(
      this.orders
        .filter((order) => !this.isTimeVisible(order.time))
        .map((order) => {
          const hovered = order.id === this.hoveredId;
          const palette = getOrderPalette(order.side, hovered);
          return {
            id: order.id,
            paneId: pane.getId(),
            value: order.price,
            text: context.getOptions().formatter.formatPrice(order.price),
            color: palette.line,
            labelColor: palette.label,
            textColor: "#ffffff",
            lineDash: [4, 3],
            lineWidth: hovered ? 3 : 1.5,
            emphasized: hovered,
          };
        })
    );
  }

  private findHoveredOrder(event: ChartPointerEvent) {
    let closestId: string | undefined;
    let closestDistance = hoverThreshold;

    for (const position of this.getPositions()) {
      const distance = position.visible
        ? Math.hypot(event.x - position.x, event.y - position.y)
        : Math.abs(event.y - position.y);
      if (distance >= closestDistance) continue;
      closestDistance = distance;
      closestId = position.order.id;
    }

    return closestId;
  }

  private setHoveredOrder(id: string | undefined) {
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    this.syncAnnotations();
    this.context?.requestRedraw("indicators");
  }

  private getPositions(): OrderPosition[] {
    const context = this.context;
    const pane = context?.getPanes()[0];
    const timeScale = pane?.getTimeScale();
    if (!context || !pane || !timeScale) return [];

    const canvas = context.getCanvasContext("indicator").canvas;
    const region = pane.getRegion();
    return this.orders.map((order) => ({
      order,
      visible: this.isTimeVisible(order.time),
      x: timeScale.project(order.time, {
        canvas,
        barAlignment: pane.getTimeAnchorAlignment(),
      }),
      y:
        region.y +
        pane.getPriceScale().project(order.price, {
          canvas: { width: region.width, height: region.height },
          devicePixelRatio: 1,
        }),
    }));
  }

  private isTimeVisible(time: number) {
    const range = this.context?.getVisibleTimeRange();
    return range !== undefined && time >= range.start && time < range.end;
  }
}

export function createProbeOrders(
  data: readonly ChartData[],
  stepSize: number
): ProbeOrder[] {
  if (data.length === 0) return [];

  const at = (index: number) => data[Math.min(index, data.length - 1)];
  const first = data[0];
  const last = data.at(-1)!;
  const candidates = [
    { id: "before-session", point: at(8), side: "buy" as const },
    { id: "visible-buy", point: at(22), side: "buy" as const },
    { id: "visible-sell", point: at(46), side: "sell" as const },
    { id: "after-session", point: at(62), side: "sell" as const },
  ];

  return candidates.flatMap(({ id, point, side }) => {
    const price = point.close ?? point.open;
    if (price == null) return [];
    const time =
      id === "before-session"
        ? first.time - stepSize
        : id === "after-session"
          ? last.time + stepSize * 2
          : point.time;
    return [{ id, price, side, time }];
  });
}

function snapshotOrders(orders: readonly ProbeOrder[]) {
  return orders.map((order) => ({ ...order }));
}

function getOrderPalette(side: ProbeOrder["side"], hovered: boolean) {
  if (side === "sell") {
    return hovered
      ? { label: "#c2185b", line: "#ff80ab", marker: "#ff80ab" }
      : { label: "#880e4f", line: "#ff4081", marker: "#ff4081" };
  }

  return hovered
    ? { label: "#008f4c", line: "#b9f6ca", marker: "#b9f6ca" }
    : { label: "#006b3c", line: "#00e676", marker: "#00e676" };
}
