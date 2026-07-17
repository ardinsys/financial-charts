import type { ChartData, TimeRange } from "../chart/types";
import type { ChartPaneState } from "../chart/chart-state";
import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";
import { DrawingManager, type DrawingManagerJSON } from "../drawings";
import type { DrawingJSON } from "../drawings";
import {
  restoreValidatedIndicator,
  type Indicator,
  type IndicatorResolver,
  type IndicatorState,
} from "../indicators/indicator";
import type { ChartCrosshairChangeEvent } from "../chart/event-emitter";

export type ChartSyncIndicatorSnapshot = IndicatorState;

export interface ChartSyncCrosshairSnapshot {
  readonly paneId: number;
  readonly price?: number;
  readonly time: number;
}

export interface ChartSyncMessageSource {
  readonly group: string;
  readonly plugin: ChartSyncPlugin;
}

export interface ChartSyncMessage<TPayload = unknown> {
  readonly channel: string;
  readonly payload: TPayload;
  readonly source: ChartSyncMessageSource;
}

export type ChartSyncMessageHandler<TPayload = unknown> = (
  message: ChartSyncMessage<TPayload>,
) => void;

export interface ChartSyncPostMessageOptions {
  includeSelf?: boolean;
}

export interface ChartSyncPluginOptions {
  crosshair?: boolean;
  drawingManager?: DrawingManager;
  drawings?: boolean;
  group?: string;
  /** Reconstructs serialized indicators with application runtime dependencies. */
  indicatorResolver?: IndicatorResolver;
  indicators?: boolean;
  initialSync?: boolean;
  messages?: boolean;
  paneHeights?: boolean;
  visibleRange?: boolean;
}

interface ChartSyncGroupState {
  crosshair?: ChartSyncCrosshairSnapshot;
  drawings?: DrawingManagerJSON;
  indicators?: readonly ChartSyncIndicatorSnapshot[];
  paneHeights?: readonly ChartPaneState[];
  visibleRange?: TimeRange;
}

interface ChartSyncGroup {
  members: Set<ChartSyncPlugin>;
  state: ChartSyncGroupState;
}

const defaultOptions = {
  crosshair: true,
  drawings: true,
  group: "default",
  indicators: true,
  initialSync: true,
  messages: true,
  paneHeights: true,
  visibleRange: true,
} satisfies Required<
  Pick<
    ChartSyncPluginOptions,
    | "crosshair"
    | "drawings"
    | "group"
    | "indicators"
    | "initialSync"
    | "messages"
    | "paneHeights"
    | "visibleRange"
  >
>;

const chartSyncGroups = new Map<string, ChartSyncGroup>();

export class ChartSyncPlugin implements ChartPlugin {
  readonly key = "chart-sync";

  /** Discards retained state without disconnecting active group members. */
  static clearGroup(group: string): void {
    const syncGroup = chartSyncGroups.get(group);
    if (!syncGroup) return;

    if (syncGroup.members.size === 0) {
      chartSyncGroups.delete(group);
      return;
    }

    syncGroup.state = {};
  }

  private applying = false;
  private ctx?: ChartContext;
  private deliveringMessage = false;
  private initialSyncSource?: ChartSyncPlugin;
  private initialSyncApplied = false;
  private suppressNextVisibleRangeChange = false;
  private waitingForInitialSync = false;
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

    if (
      (this.options.initialSync ?? defaultOptions.initialSync) &&
      (this.hasStoredState() || peers[0])
    ) {
      this.initialSyncSource = peers[0];
      this.waitingForInitialSync = true;
      this.applyInitialState();
    }
    this.storeInitialStateIfEmpty();
  }

  detach(): void {
    this.storeCurrentState();
    for (const unsubscribe of this.unsubscribers.splice(0)) {
      unsubscribe();
    }
    this.messageHandlers.clear();
    this.initialSyncSource = undefined;
    this.initialSyncApplied = false;
    this.suppressNextVisibleRangeChange = false;
    this.waitingForInitialSync = false;
    const group = chartSyncGroups.get(this.group);
    group?.members.delete(this);
    if (!group || (group.members.size === 0 && !this.hasStoredState())) {
      chartSyncGroups.delete(this.group);
    }
    this.ctx = undefined;
  }

  onVisibleRangeChanged(_range: TimeRange): void {
    if (!this.isEnabled("visibleRange") || this.applying) return;
    if (this.suppressNextVisibleRangeChange) {
      this.suppressNextVisibleRangeChange = false;
      return;
    }
    if (this.hasPendingInitialSync()) return;

    const range = this.createVisibleRangeSnapshot();
    if (!range) return;

    this.storeVisibleRange(range);
    this.broadcast((peer) => peer.applyVisibleRange(range));
  }

  onData(data: readonly ChartData[]): void {
    if (data.length > 0 && this.isInitialSyncEnabled()) {
      this.applyInitialState();
    }
    this.storeInitialStateIfEmpty();
  }

  onPaneHeightsChanged(panes: readonly ChartPaneState[]): void {
    if (!this.isEnabled("paneHeights") || this.applying) return;
    if (this.hasPendingInitialSync()) return;

    this.storePaneHeights(panes);
    this.broadcast((peer) => peer.applyPaneHeights(panes));
  }

  onMessage<TPayload = unknown>(
    channel: string,
    handler: ChartSyncMessageHandler<TPayload>,
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
    options: ChartSyncPostMessageOptions = {},
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
          this.storeCrosshair(snapshot);
          this.broadcast((peer) => peer.applyCrosshair(snapshot));
        }),
        ctx.on("crosshair-clear", () => {
          if (this.applying) return;
          this.storeCrosshair(undefined);
          this.broadcast((peer) => peer.applyCrosshair(undefined));
        }),
      );
    }

    if (this.isEnabled("drawings")) {
      unsubscribers.push(
        ctx.on("drawing-create", ({ drawing }) => {
          if (this.applying) return;
          const snapshot = drawing.toJSON();
          this.storeDrawing(snapshot);
          this.broadcastDrawing(snapshot);
        }),
        ctx.on("drawing-change", ({ drawing }) => {
          if (this.applying) return;
          const snapshot = drawing.toJSON();
          this.storeDrawing(snapshot);
          this.broadcastDrawing(snapshot);
        }),
        ctx.on("drawing-delete", ({ drawing }) => {
          if (this.applying) return;
          this.removeStoredDrawing(drawing.id);
          this.broadcast((peer) => peer.applyDrawingDelete(drawing.id));
        }),
        ctx.on("drawing-select", ({ id }) => {
          if (this.applying) return;
          this.storeDrawingSelection(id);
          this.broadcast((peer) => peer.applyDrawingSelection(id));
        }),
      );
    }

    if (this.isEnabled("indicators")) {
      unsubscribers.push(
        ctx.on("indicator-add", ({ indicator }) => {
          if (this.applying) return;
          const snapshot = this.createIndicatorSnapshot(indicator);
          this.storeIndicator(snapshot);
          this.broadcastIndicator(snapshot);
        }),
        ctx.on("indicator-change", ({ indicator }) => {
          if (this.applying) return;
          const snapshot = this.createIndicatorSnapshot(indicator);
          this.storeIndicator(snapshot);
          this.broadcastIndicator(snapshot);
        }),
        ctx.on("indicator-visibility-changed", ({ indicator }) => {
          if (this.applying) return;
          const snapshot = this.createIndicatorSnapshot(indicator);
          this.storeIndicator(snapshot);
          this.broadcastIndicator(snapshot);
        }),
        ctx.on("indicator-remove", ({ indicator }) => {
          if (this.applying) return;
          const instanceId = indicator.getInstanceId();
          this.removeStoredIndicator(instanceId);
          this.broadcast((peer) => peer.applyIndicatorRemove(instanceId));
        }),
      );
    }

    return unsubscribers;
  }

  private register() {
    const group =
      chartSyncGroups.get(this.group) ??
      ({
        members: new Set<ChartSyncPlugin>(),
        state: {},
      } satisfies ChartSyncGroup);
    group.members.add(this);
    chartSyncGroups.set(this.group, group);
  }

  private getPeers() {
    return [...(chartSyncGroups.get(this.group)?.members ?? [])].filter(
      (plugin) => plugin !== this && plugin.ctx,
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
    payload: TPayload,
  ): ChartSyncMessage<TPayload> | undefined {
    if (!this.ctx) return undefined;

    return {
      channel: this.normalizeMessageChannel(channel),
      payload,
      source: {
        group: this.group,
        plugin: this,
      },
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

  private getGroup() {
    const group =
      chartSyncGroups.get(this.group) ??
      ({
        members: new Set<ChartSyncPlugin>(),
        state: {},
      } satisfies ChartSyncGroup);
    chartSyncGroups.set(this.group, group);
    return group;
  }

  private hasStoredState() {
    const state = chartSyncGroups.get(this.group)?.state;
    return !!state && Object.keys(state).length > 0;
  }

  private storeInitialStateIfEmpty() {
    if (this.hasStoredState()) return;
    this.storeCurrentState();
  }

  private storeCurrentState() {
    if (!this.ctx || this.ctx.getData().length === 0) return;

    if (this.isEnabled("visibleRange")) {
      const range = this.createVisibleRangeSnapshot();
      if (range) this.storeVisibleRange(range);
    }
    if (this.isEnabled("drawings")) {
      this.storeDrawingState();
    }
    if (this.isEnabled("indicators")) {
      this.storeIndicatorState();
    }
    if (this.isEnabled("paneHeights")) {
      this.storePaneHeights(this.createPaneHeightSnapshot());
    }
    if (this.isEnabled("crosshair")) {
      const state = this.ctx.getCrosshairState();
      this.storeCrosshair(
        state ? this.createCrosshairSnapshot(state) : undefined,
      );
    }
  }

  private storeVisibleRange(range: TimeRange) {
    this.getGroup().state.visibleRange = range;
  }

  private createVisibleRangeSnapshot(): TimeRange | undefined {
    if (!this.ctx || this.ctx.getData().length === 0) return undefined;

    return this.ctx.getVisibleTimeWindow();
  }

  private storeCrosshair(snapshot?: ChartSyncCrosshairSnapshot) {
    this.getGroup().state.crosshair = snapshot;
  }

  private storeDrawingState() {
    const state = this.getDrawingManager()?.toJSON();
    if (state) {
      this.getGroup().state.drawings = state;
    }
  }

  private storeDrawing(snapshot: DrawingJSON) {
    const group = this.getGroup();
    const state = group.state.drawings;
    if (!state) {
      this.storeDrawingState();
      return;
    }

    const index = state.drawings.findIndex(
      (drawing) => drawing.id === snapshot.id,
    );
    const drawings =
      index === -1
        ? [...state.drawings, snapshot]
        : state.drawings.map((drawing, drawingIndex) =>
            drawingIndex === index ? snapshot : drawing,
          );

    group.state.drawings = createDrawingState(
      drawings,
      state.selectedDrawingId,
    );
  }

  private removeStoredDrawing(id: string) {
    const group = this.getGroup();
    const state = group.state.drawings;
    if (!state) {
      this.storeDrawingState();
      return;
    }

    group.state.drawings = createDrawingState(
      state.drawings.filter((drawing) => drawing.id !== id),
      state.selectedDrawingId === id ? undefined : state.selectedDrawingId,
    );
  }

  private storeDrawingSelection(id?: string) {
    const group = this.getGroup();
    const state = group.state.drawings;
    if (!state) {
      this.storeDrawingState();
      return;
    }

    group.state.drawings = createDrawingState(state.drawings, id);
  }

  private storeIndicatorState() {
    this.getGroup().state.indicators = this.createIndicatorState();
  }

  private storePaneHeights(panes: readonly ChartPaneState[]) {
    this.getGroup().state.paneHeights = panes;
  }

  private storeIndicator(snapshot: ChartSyncIndicatorSnapshot) {
    const group = this.getGroup();
    const state = group.state.indicators;
    if (!state) {
      this.storeIndicatorState();
      return;
    }

    const index = state.findIndex(
      (indicator) => indicator.instanceId === snapshot.instanceId,
    );
    group.state.indicators =
      index === -1
        ? [...state, snapshot]
        : state.map((indicator, indicatorIndex) =>
            indicatorIndex === index ? snapshot : indicator,
          );
  }

  private removeStoredIndicator(instanceId: string) {
    const group = this.getGroup();
    const state = group.state.indicators;
    if (!state) {
      this.storeIndicatorState();
      return;
    }

    group.state.indicators = state.filter(
      (indicator) => indicator.instanceId !== instanceId,
    );
  }

  private applyInitialState() {
    if (!this.isInitialSyncEnabled()) return;
    if (!this.ctx || this.ctx.getData().length === 0) return;

    if (this.initialSyncApplied) {
      this.initialSyncSource = undefined;
      this.waitingForInitialSync = false;
      return;
    }

    let state = this.createStoredStateSnapshot();
    if (!state) {
      const source = this.initialSyncSource?.ctx
        ? this.initialSyncSource
        : this.getPeers()[0];
      if (!source) return;

      state = source.createCurrentStateSnapshot();
      this.getGroup().state = cloneSyncState(state);
    }
    this.suppressNextVisibleRangeChange = Boolean(
      this.isEnabled("visibleRange") && state.visibleRange,
    );
    this.apply(() => {
      if (this.isEnabled("visibleRange") && state.visibleRange) {
        this.applyVisibleRange(state.visibleRange);
      }

      if (this.isEnabled("drawings") && state.drawings) {
        this.applyDrawingState(state.drawings);
      }

      if (this.isEnabled("indicators") && state.indicators) {
        this.applyIndicatorState(state.indicators);
      }

      if (this.isEnabled("paneHeights") && state.paneHeights) {
        this.applyPaneHeights(state.paneHeights);
      }

      if (
        this.isEnabled("crosshair") &&
        Object.prototype.hasOwnProperty.call(state, "crosshair")
      ) {
        this.applyCrosshair(state.crosshair);
      }
    });
    this.initialSyncApplied = true;
    this.initialSyncSource = undefined;
    this.waitingForInitialSync = false;
  }

  private createStoredStateSnapshot() {
    const state = chartSyncGroups.get(this.group)?.state;
    if (!state || Object.keys(state).length === 0) return undefined;

    return cloneSyncState(state);
  }

  private createCurrentStateSnapshot(): ChartSyncGroupState {
    const state: ChartSyncGroupState = {};

    if (this.ctx && this.isEnabled("visibleRange")) {
      state.visibleRange = this.createVisibleRangeSnapshot();
    }
    if (this.isEnabled("drawings")) {
      const drawingState = this.getDrawingManager()?.toJSON();
      if (drawingState) {
        state.drawings = drawingState;
      }
    }
    if (this.isEnabled("indicators")) {
      state.indicators = this.createIndicatorState();
    }
    if (this.ctx && this.isEnabled("paneHeights")) {
      state.paneHeights = this.createPaneHeightSnapshot();
    }
    if (this.ctx && this.isEnabled("crosshair")) {
      const crosshairState = this.ctx.getCrosshairState();
      state.crosshair = crosshairState
        ? this.createCrosshairSnapshot(crosshairState)
        : undefined;
    }

    return state;
  }

  private applyVisibleRange(range: TimeRange) {
    this.ctx?.setVisibleTimeWindow(range);
  }

  private createPaneHeightSnapshot(): readonly ChartPaneState[] {
    return this.ctx?.getPaneHeightRatios() ?? [];
  }

  private applyPaneHeights(panes: readonly ChartPaneState[]) {
    this.ctx?.setPaneHeightRatios(panes);
  }

  private createCrosshairSnapshot(
    event: ChartCrosshairChangeEvent,
  ): ChartSyncCrosshairSnapshot {
    return {
      paneId: event.paneId,
      price: event.price,
      time: event.time,
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
      emitSelection: true,
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

  private broadcastIndicator(snapshot: ChartSyncIndicatorSnapshot) {
    this.broadcast((peer) => peer.applyIndicator(snapshot));
  }

  private createIndicatorState() {
    return (
      this.ctx
        ?.getIndicators()
        .map((indicator) => this.createIndicatorSnapshot(indicator)) ?? []
    );
  }

  private createIndicatorSnapshot(
    indicator: Indicator<any, any>,
  ): ChartSyncIndicatorSnapshot {
    return indicator.toJSON();
  }

  private applyIndicatorState(
    snapshots: readonly ChartSyncIndicatorSnapshot[],
  ) {
    const instanceIds = new Set(
      snapshots.map((snapshot) => snapshot.instanceId),
    );
    for (const indicator of this.ctx?.getIndicators() ?? []) {
      if (!instanceIds.has(indicator.getInstanceId())) {
        this.ctx?.removeIndicator(indicator);
      }
    }

    for (const snapshot of snapshots) {
      this.applyIndicator(snapshot);
    }
  }

  private applyIndicator(snapshot: ChartSyncIndicatorSnapshot) {
    if (!this.ctx) return;
    const resolver = this.options.indicatorResolver;
    if (!resolver) {
      throw new Error(
        "ChartSyncPlugin requires indicatorResolver to synchronize indicators.",
      );
    }

    const restored = restoreValidatedIndicator(snapshot, resolver);
    const instanceId = restored.getInstanceId();
    let indicator = this.findIndicator(instanceId);
    if (
      indicator &&
      indicator.getIndicatorType() !== restored.getIndicatorType()
    ) {
      this.ctx.removeIndicator(indicator);
      indicator = undefined;
    }

    if (!indicator) {
      this.ctx.addIndicator(restored);
      return;
    }

    indicator.copyFrom(restored);
  }

  private applyIndicatorRemove(instanceId: string) {
    const indicator = this.findIndicator(instanceId);
    if (indicator) {
      this.ctx?.removeIndicator(indicator);
    }
  }

  private findIndicator(instanceId: string) {
    return this.ctx?.getIndicatorById(instanceId);
  }

  private getDrawingManager() {
    return (
      this.options.drawingManager ??
      this.ctx
        ?.getPlugins()
        .find(
          (plugin): plugin is DrawingManager =>
            plugin instanceof DrawingManager,
        ) ??
      undefined
    );
  }

  private isEnabled(
    key:
      | "crosshair"
      | "drawings"
      | "indicators"
      | "messages"
      | "paneHeights"
      | "visibleRange",
  ) {
    return this.options[key] ?? defaultOptions[key];
  }

  private isInitialSyncEnabled() {
    return this.options.initialSync ?? defaultOptions.initialSync;
  }

  private hasPendingInitialSync() {
    return this.isInitialSyncEnabled() && this.waitingForInitialSync;
  }
}

function cloneSyncState(state: ChartSyncGroupState): ChartSyncGroupState {
  const clone: ChartSyncGroupState = {};

  if (state.visibleRange) {
    clone.visibleRange = state.visibleRange;
  }
  if (state.drawings) {
    clone.drawings = state.drawings;
  }
  if (state.indicators) {
    clone.indicators = state.indicators;
  }
  if (state.paneHeights) {
    clone.paneHeights = state.paneHeights;
  }
  if (Object.prototype.hasOwnProperty.call(state, "crosshair")) {
    clone.crosshair = state.crosshair;
  }

  return clone;
}

function createDrawingState(
  drawings: readonly DrawingJSON[],
  selectedDrawingId?: string,
): DrawingManagerJSON {
  return {
    drawings,
    ...(selectedDrawingId === undefined ? {} : { selectedDrawingId }),
  };
}
