import type { TimeRange } from "../chart/types";
import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";
import { DrawingManager, type DrawingManagerJSON } from "../drawings";
import type { DrawingJSON } from "../drawings";
import { Indicator } from "../indicators/indicator";
import type { ChartCrosshairChangeEvent } from "../chart/event-emitter";
import type { FinancialChart } from "../chart/financial-chart";

export interface ChartSyncIndicatorSnapshot {
  indicator: Indicator<any, any>;
  key: string;
  type: string;
}

export interface ChartSyncCrosshairSnapshot {
  paneId: number;
  price?: number;
  time: number;
}

export interface ChartSyncMessageSource {
  chart: FinancialChart;
  group: string;
}

export interface ChartSyncMessage<TPayload = unknown> {
  channel: string;
  payload: TPayload;
  source: ChartSyncMessageSource;
}

export type ChartSyncMessageHandler<TPayload = unknown> = (
  message: ChartSyncMessage<TPayload>
) => void;

export interface ChartSyncPostMessageOptions {
  includeSelf?: boolean;
}

export interface ChartSyncPluginOptions {
  crosshair?: boolean;
  drawingManager?: DrawingManager;
  drawings?: boolean;
  group?: string;
  indicators?: boolean;
  initialSync?: boolean;
  messages?: boolean;
  visibleRange?: boolean;
}

const defaultOptions = {
  crosshair: true,
  drawings: true,
  group: "default",
  indicators: true,
  initialSync: true,
  messages: true,
  visibleRange: true
} satisfies Required<
  Pick<
    ChartSyncPluginOptions,
    | "crosshair"
    | "drawings"
    | "group"
    | "indicators"
    | "initialSync"
    | "messages"
    | "visibleRange"
  >
>;

const chartSyncGroups = new Map<string, Set<ChartSyncPlugin>>();

export class ChartSyncPlugin implements ChartPlugin {
  readonly key = "chart-sync";

  private applying = false;
  private ctx?: ChartContext;
  private deliveringMessage = false;
  private readonly group: string;
  private readonly messageHandlers = new Map<
    string,
    Set<ChartSyncMessageHandler<any>>
  >();
  private unsubscribers: Array<() => void> = [];

  constructor(private readonly options: ChartSyncPluginOptions = {}) {
    this.group = options.group ?? defaultOptions.group;
  }

  attach(ctx: ChartContext): void {
    this.ctx = ctx;
    const peers = this.getPeers();
    this.register();
    this.unsubscribers = this.createEventListeners(ctx);

    if ((this.options.initialSync ?? defaultOptions.initialSync) && peers[0]) {
      this.applyInitialState(peers[0]);
    }
  }

  detach(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) {
      unsubscribe();
    }
    this.messageHandlers.clear();
    const group = chartSyncGroups.get(this.group);
    group?.delete(this);
    if (!group || group.size === 0) {
      chartSyncGroups.delete(this.group);
    }
    this.ctx = undefined;
  }

  onVisibleRangeChanged(range: TimeRange): void {
    if (!this.isEnabled("visibleRange") || this.applying) return;

    this.broadcast((peer) => peer.applyVisibleRange(range));
  }

  onMessage<TPayload = unknown>(
    channel: string,
    handler: ChartSyncMessageHandler<TPayload>
  ) {
    const normalizedChannel = this.normalizeMessageChannel(channel);
    const handlers =
      this.messageHandlers.get(normalizedChannel) ??
      new Set<ChartSyncMessageHandler<any>>();

    handlers.add(handler);
    this.messageHandlers.set(normalizedChannel, handlers);

    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(normalizedChannel);
      }
    };
  }

  postMessage<TPayload = unknown>(
    channel: string,
    payload: TPayload,
    options: ChartSyncPostMessageOptions = {}
  ) {
    if (!this.isEnabled("messages")) return;
    if (this.applying || this.deliveringMessage) return;

    const message = this.createMessage(channel, payload);
    if (!message) return;

    if (options.includeSelf) {
      this.apply(() => this.applyMessage(message));
    }

    this.broadcast((peer) => peer.applyMessage(message));
  }

  private createEventListeners(ctx: ChartContext) {
    const unsubscribers: Array<() => void> = [];

    if (this.isEnabled("crosshair")) {
      unsubscribers.push(
        ctx.on("crosshair-change", (event) => {
          if (this.applying) return;
          const snapshot = this.createCrosshairSnapshot(event);
          this.broadcast((peer) => peer.applyCrosshair(snapshot));
        }),
        ctx.on("crosshair-clear", () => {
          if (this.applying) return;
          this.broadcast((peer) => peer.applyCrosshair(undefined));
        })
      );
    }

    if (this.isEnabled("drawings")) {
      unsubscribers.push(
        ctx.on("drawing-create", ({ drawing }) => {
          if (this.applying) return;
          this.broadcastDrawing(drawing.toJSON());
        }),
        ctx.on("drawing-change", ({ drawing }) => {
          if (this.applying) return;
          this.broadcastDrawing(drawing.toJSON());
        }),
        ctx.on("drawing-delete", ({ drawing }) => {
          if (this.applying) return;
          this.broadcast((peer) => peer.applyDrawingDelete(drawing.id));
        }),
        ctx.on("drawing-select", ({ id }) => {
          if (this.applying) return;
          this.broadcast((peer) => peer.applyDrawingSelection(id));
        })
      );
    }

    if (this.isEnabled("indicators")) {
      unsubscribers.push(
        ctx.on("indicator-add", ({ indicator }) => {
          if (this.applying) return;
          this.broadcastIndicator(indicator);
        }),
        ctx.on("indicator-change", ({ indicator }) => {
          if (this.applying) return;
          this.broadcastIndicator(indicator);
        }),
        ctx.on("indicator-visibility-changed", ({ indicator }) => {
          if (this.applying) return;
          this.broadcastIndicator(indicator);
        }),
        ctx.on("indicator-remove", ({ indicator }) => {
          if (this.applying) return;
          const key = indicator.getKey();
          this.broadcast((peer) => peer.applyIndicatorRemove(key));
        })
      );
    }

    return unsubscribers;
  }

  private register() {
    const group = chartSyncGroups.get(this.group) ?? new Set<ChartSyncPlugin>();
    group.add(this);
    chartSyncGroups.set(this.group, group);
  }

  private getPeers() {
    return [...(chartSyncGroups.get(this.group) ?? [])].filter(
      (plugin) => plugin !== this && plugin.ctx
    );
  }

  private broadcast(callback: (peer: ChartSyncPlugin) => void) {
    for (const peer of this.getPeers()) {
      peer.apply(() => callback(peer));
    }
  }

  private apply(callback: () => void) {
    this.applying = true;
    try {
      callback();
    } finally {
      this.applying = false;
    }
  }

  private createMessage<TPayload>(
    channel: string,
    payload: TPayload
  ): ChartSyncMessage<TPayload> | undefined {
    if (!this.ctx) return undefined;

    return {
      channel: this.normalizeMessageChannel(channel),
      payload,
      source: {
        chart: this.ctx.chart,
        group: this.group
      }
    };
  }

  private applyMessage<TPayload>(message: ChartSyncMessage<TPayload>) {
    if (!this.isEnabled("messages")) return;

    this.deliveringMessage = true;
    try {
      this.deliverMessage(message);
    } finally {
      this.deliveringMessage = false;
    }
  }

  private deliverMessage<TPayload>(message: ChartSyncMessage<TPayload>) {
    for (const handler of this.messageHandlers.get(message.channel) ?? []) {
      handler(message);
    }
  }

  private normalizeMessageChannel(channel: string) {
    const normalizedChannel = channel.trim();
    if (!normalizedChannel) {
      throw new Error("ChartSyncPlugin message channel must not be empty.");
    }

    return normalizedChannel;
  }

  private applyInitialState(source: ChartSyncPlugin) {
    this.apply(() => {
      if (this.isEnabled("visibleRange")) {
        const range = source.ctx?.chart.getVisibleTimeRange();
        if (range) this.applyVisibleRange(range);
      }

      if (this.isEnabled("drawings")) {
        const state = source.getDrawingManager()?.toJSON();
        if (state) this.applyDrawingState(state);
      }

      if (this.isEnabled("indicators")) {
        this.applyIndicatorState(source.createIndicatorState());
      }

      if (this.isEnabled("crosshair")) {
        const state = source.ctx?.chart.getCrosshairState();
        this.applyCrosshair(
          state ? source.createCrosshairSnapshot(state) : undefined
        );
      }
    });
  }

  private applyVisibleRange(range: TimeRange) {
    this.ctx?.chart.setVisibleTimeRange(range);
  }

  private createCrosshairSnapshot(
    event: ChartCrosshairChangeEvent
  ): ChartSyncCrosshairSnapshot {
    const region = event.pane.getRegion();
    const relativeY = event.pane.getRelativeY(event.y);
    const price = event.pane.getPriceScale().unproject(relativeY, {
      canvas: { width: region.width, height: region.height }
    });

    return {
      paneId: event.pane.getId(),
      price,
      time: event.time
    };
  }

  private applyCrosshair(snapshot?: ChartSyncCrosshairSnapshot) {
    if (!this.ctx) return;

    if (!snapshot) {
      this.ctx.clearCrosshair();
      return;
    }

    this.ctx.setCrosshair(snapshot);
  }

  private broadcastDrawing(json: DrawingJSON) {
    this.broadcast((peer) => peer.applyDrawing(json));
  }

  private applyDrawing(json: DrawingJSON) {
    this.getDrawingManager()?.upsertDrawing(json, {
      emit: true,
      emitSelection: true
    });
  }

  private applyDrawingDelete(id: string) {
    this.getDrawingManager()?.removeDrawingById(id, { emit: true });
  }

  private applyDrawingSelection(id?: string) {
    this.getDrawingManager()?.selectDrawingById(id, { force: true });
  }

  private applyDrawingState(state: DrawingManagerJSON) {
    this.getDrawingManager()?.fromJSON(state);
  }

  private broadcastIndicator(indicator: Indicator<any, any>) {
    const snapshot = this.createIndicatorSnapshot(indicator);
    this.broadcast((peer) => peer.applyIndicator(snapshot));
  }

  private createIndicatorState() {
    return (
      this.ctx?.chart
        .getAllIndicators()
        .map((indicator) => this.createIndicatorSnapshot(indicator)) ?? []
    );
  }

  private createIndicatorSnapshot(
    indicator: Indicator<any, any>
  ): ChartSyncIndicatorSnapshot {
    return {
      indicator,
      key: indicator.getKey(),
      type: indicator.getIndicatorType()
    };
  }

  private applyIndicatorState(snapshots: ChartSyncIndicatorSnapshot[]) {
    const keys = new Set(snapshots.map((snapshot) => snapshot.key));
    for (const indicator of this.ctx?.chart.getAllIndicators() ?? []) {
      if (!keys.has(indicator.getKey())) {
        this.ctx?.chart.removeIndicator(indicator, { emit: false });
      }
    }

    for (const snapshot of snapshots) {
      this.applyIndicator(snapshot);
    }
  }

  private applyIndicator(snapshot: ChartSyncIndicatorSnapshot) {
    if (!this.ctx) return;

    let indicator = this.findIndicator(snapshot.key);
    if (indicator && indicator.getIndicatorType() !== snapshot.type) {
      this.ctx.chart.removeIndicator(indicator, { emit: false });
      indicator = undefined;
    }

    if (!indicator) {
      indicator = snapshot.indicator.clone();
      this.ctx.chart.addIndicator(indicator, { emit: false });
      return;
    }

    indicator.copyFrom(snapshot.indicator, { emit: false });
  }

  private applyIndicatorRemove(key: string) {
    const indicator = this.findIndicator(key);
    if (indicator) {
      this.ctx?.chart.removeIndicator(indicator, { emit: false });
    }
  }

  private findIndicator(key: string) {
    return this.ctx?.chart
      .getAllIndicators()
      .find((indicator) => indicator.getKey() === key);
  }

  private getDrawingManager() {
    return (
      this.options.drawingManager ??
      this.ctx?.chart
        .getPlugins()
        .find(
          (plugin): plugin is DrawingManager => plugin instanceof DrawingManager
        ) ??
      undefined
    );
  }

  private isEnabled(
    key: "crosshair" | "drawings" | "indicators" | "messages" | "visibleRange"
  ) {
    return this.options[key] ?? defaultOptions[key];
  }
}

Object.defineProperty(ChartSyncPlugin, "getGroupSizeForTest", {
  value: (group: string) => chartSyncGroups.get(group)?.size ?? 0
});
