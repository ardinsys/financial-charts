import type {
  ChartOptionsChangeEvent,
  ChartOptionsSnapshot,
} from "../chart/chart-options";
import type {
  ChartCrosshairOptions,
  ChartCrosshairState,
} from "../interaction/crosshair";
import type {
  ChartCanvasLayer,
  ChartRedrawPart,
} from "../render/chart-render-types";
import type { PriceAxisAnnotation } from "../annotations/price-axis-annotation";
import type { ChartEventMap } from "../chart/event-emitter";
import type { ChartData, TimeRange } from "../chart/types";
import type { ChartPaneState } from "../chart/chart-state";
import type { Pane } from "../panes/pane";
import type { RenderCallback, RenderStage } from "../render/render-pipeline";
import type { ChartDOMAdapter } from "../ui/chart-dom-adapter";
import type {
  DefaultIndicatorOptions,
  Indicator,
} from "../indicators/indicator";
import type { TimeScaleRange } from "../scales/time-scale";

export interface Drawable {
  beforeDraw?(): void;
  draw?(): void;
  afterDraw?(): void;
}

export interface ChartPointerEvent {
  readonly type: "down" | "move" | "up";
  readonly x: number;
  readonly y: number;
  readonly time: number;
  readonly pane: Pane;
  readonly dataPoint: ChartData;
  readonly button?: number;
  readonly buttons?: number;
  /** True when the active gesture ended without committing its changes. */
  readonly cancelled?: boolean;
}

export interface ExtensionContext {
  readonly domAdapter: ChartDOMAdapter;
  readonly hostElement: HTMLElement;
  /** Aborted when the owning extension is detached or the chart is disposed. */
  readonly signal: AbortSignal;
  emit<K extends keyof ChartEventMap>(event: K, data: ChartEventMap[K]): void;
  getData(): readonly ChartData[];
  getOptions(): ChartOptionsSnapshot;
  getCanvasContext(layer: ChartCanvasLayer): CanvasRenderingContext2D;
  getLogicalCanvas(layer: ChartCanvasLayer): { width: number; height: number };
  getPanes(): readonly Pane[];
  getPlugin<TPlugin extends ChartPlugin = ChartPlugin>(
    key: string
  ): TPlugin | undefined;
  getPlugins(): readonly ChartPlugin[];
  getVisibleTimeWindow(): TimeRange;
  getVisibleTimeRange(): TimeRange;
  /** Subscribes for this attachment and returns an early disposer. */
  on<K extends keyof ChartEventMap>(
    event: K,
    listener: (data: ChartEventMap[K]) => void
  ): () => void;
  /** Registers an attachment-scoped render hook and returns an early disposer. */
  onRenderStage(stage: RenderStage, callback: RenderCallback): () => void;
  requestRedraw(
    part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>,
    immediate?: boolean
  ): void;
  /** Replaces the annotations owned by this attachment. */
  setPriceAxisAnnotations(annotations: readonly PriceAxisAnnotation[]): void;
  /** Removes every price-axis annotation owned by this attachment. */
  clearPriceAxisAnnotations(): void;
  setCrosshair(options: ChartCrosshairOptions): ChartCrosshairState | undefined;
  clearCrosshair(): void;
  /** Detaches the owning extension with normal chart removal semantics. */
  remove(): void;
}

export interface ChartContext extends ExtensionContext {
  getCrosshairState(): ChartCrosshairState | undefined;
  getVisibleLogicalRange(): TimeScaleRange;
  /** Returns portable pane ratios keyed by main-pane or indicator identity. */
  getPaneHeightRatios(): readonly ChartPaneState[];
  /** Applies portable pane ratios against this chart's available height. */
  setPaneHeightRatios(panes: readonly ChartPaneState[]): void;
  setVisibleTimeWindow(range: TimeRange): void;
  getIndicators(): readonly Indicator<object, DefaultIndicatorOptions>[];
  getIndicatorById(
    instanceId: string
  ): Indicator<object, DefaultIndicatorOptions> | undefined;
  addIndicator(indicator: Indicator<object, DefaultIndicatorOptions>): void;
  removeIndicator(indicator: Indicator<object, DefaultIndicatorOptions>): void;
}

export interface ChartExtension extends Drawable {
  readonly key: string;
  onData?(data: readonly ChartData[]): void;
  /** Called once after an effective view change with the whole-bar range. */
  onVisibleRangeChanged?(range: TimeRange): void;
  /** Called after an explicit or interactive pane-height change. */
  onPaneHeightsChanged?(panes: readonly ChartPaneState[]): void;
  /** An empty `changedKeys` array identifies initial state delivery. */
  onOptionsChanged?(event: ChartOptionsChangeEvent): void;
  onPointer?(event: ChartPointerEvent): boolean | void;
  onDrawingFinished?(event: ChartEventMap["drawing-finished"]): void;
  detach?(): void;
}

export interface ChartPlugin extends ChartExtension {
  attach(ctx: ChartContext): void;
}
