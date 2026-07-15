import type {
  FinancialChart
} from "../chart/financial-chart";
import type {
  ChartOptionsChangeEvent,
  ChartOptionsSnapshot
} from "../chart/chart-options";
import type {
  ChartCrosshairOptions,
  ChartCrosshairState
} from "../interaction/crosshair";
import type {
  ChartCanvasLayer,
  ChartRedrawPart
} from "../render/chart-render-types";
import type { PriceAxisAnnotation } from "../annotations/price-axis-annotation";
import type { ChartEventMap } from "../chart/event-emitter";
import type { ChartData, TimeRange } from "../chart/types";
import type { Pane } from "../panes/pane";
import type { RenderCallback, RenderStage } from "../render/render-pipeline";
import type { ChartDOMAdapter } from "../ui/chart-dom-adapter";

export interface Drawable {
  beforeDraw?(): void;
  draw?(): void;
  afterDraw?(): void;
}

export interface ChartPointerEvent {
  type: "down" | "move" | "up";
  x: number;
  y: number;
  time: number;
  pane: Pane;
  dataPoint: ChartData;
  button?: number;
  buttons?: number;
}

export interface ExtensionContext {
  domAdapter: ChartDOMAdapter;
  readonly hostElement: HTMLElement;
  /** Aborted when the owning extension is detached or the chart is disposed. */
  signal: AbortSignal;
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
}

export interface ChartContext extends ExtensionContext {
  chart: FinancialChart;
}

export interface ChartExtension extends Drawable {
  readonly key: string;
  onData?(data: readonly ChartData[]): void;
  /** Called once after an effective view change with the whole-bar range. */
  onVisibleRangeChanged?(range: TimeRange): void;
  /** An empty `changedKeys` array identifies initial state delivery. */
  onOptionsChanged?(event: ChartOptionsChangeEvent): void;
  onPointer?(event: ChartPointerEvent): boolean | void;
  onDrawingFinished?(event: ChartEventMap["drawing-finished"]): void;
  detach?(): void;
}

export interface ChartPlugin extends ChartExtension {
  attach(ctx: ChartContext): void;
}
