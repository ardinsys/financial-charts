import type {
  ChartCanvasLayer,
  ChartCrosshairOptions,
  ChartCrosshairState,
  ChartOptionsChangeEvent,
  ChartRedrawPart,
  FinancialChart
} from "../chart/financial-chart";
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

export interface ChartContext {
  chart: FinancialChart;
  domAdapter: ChartDOMAdapter;
  /** Aborted when the owning extension is detached or the chart is disposed. */
  signal: AbortSignal;
  emit<K extends keyof ChartEventMap>(event: K, data: ChartEventMap[K]): void;
  getCanvasContext(layer: ChartCanvasLayer): CanvasRenderingContext2D;
  getLogicalCanvas(layer: ChartCanvasLayer): { width: number; height: number };
  getPanes(): readonly Pane[];
  getPlugin<TPlugin extends ChartPlugin = ChartPlugin>(
    key: string
  ): TPlugin | undefined;
  getPlugins(): readonly ChartPlugin[];
  getVisibleTimeWindow(): TimeRange;
  getVisibleTimeRange(): TimeRange;
  on<K extends keyof ChartEventMap>(
    event: K,
    listener: (data: ChartEventMap[K]) => void
  ): () => void;
  onRenderStage(stage: RenderStage, callback: RenderCallback): () => void;
  requestRedraw(
    part: ChartRedrawPart | ReadonlyArray<ChartRedrawPart>,
    immediate?: boolean
  ): void;
  setCrosshair(options: ChartCrosshairOptions): ChartCrosshairState | undefined;
  clearCrosshair(): void;
}

export interface ChartPlugin extends Drawable {
  readonly key: string;
  attach(ctx: ChartContext): void;
  onData?(data: readonly ChartData[]): void;
  /** Called once after an effective view change with the whole-bar range. */
  onVisibleRangeChanged?(range: TimeRange): void;
  /** An empty `changedKeys` array identifies initial state delivery. */
  onOptionsChanged?(event: ChartOptionsChangeEvent): void;
  onPointer?(event: ChartPointerEvent): boolean | void;
  onDrawingFinished?(event: ChartEventMap["drawing-finished"]): void;
  detach?(): void;
}
