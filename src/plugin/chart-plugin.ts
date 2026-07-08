import type { ChartRedrawPart, FinancialChart } from "../chart/financial-chart";
import type { ChartEventMap } from "../chart/event-emitter";
import type { ChartData, TimeRange } from "../chart/types";
import type { Pane } from "../panes/pane";
import type { RenderCallback, RenderStage } from "../render/render-pipeline";

export interface Drawable {
  beforeDraw?(): void;
  draw?(): void;
  afterDraw?(): void;
}

export interface ChartPointerEvent {
  x: number;
  y: number;
  time: number;
  pane: Pane;
  dataPoint: ChartData;
}

export interface ChartContext {
  chart: FinancialChart;
  getPanes(): Pane[];
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
}

export interface ChartPlugin extends Drawable {
  readonly key: string;
  attach(ctx: ChartContext): void;
  onData?(data: readonly ChartData[]): void;
  onVisibleRangeChanged?(range: TimeRange): void;
  onPointer?(event: ChartPointerEvent): void;
  detach?(): void;
}
