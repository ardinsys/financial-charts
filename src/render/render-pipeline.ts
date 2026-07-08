export type RenderStage =
  | "beforeDraw"
  | "grid"
  | "axes"
  | "series"
  | "indicators"
  | "drawings"
  | "crosshair"
  | "afterDraw";

export type RenderLayer = Exclude<RenderStage, "beforeDraw" | "afterDraw">;

export type RenderCallback = () => void;

export const renderStageOrder: readonly RenderStage[] = [
  "beforeDraw",
  "grid",
  "axes",
  "series",
  "indicators",
  "drawings",
  "crosshair",
  "afterDraw"
];

export class RenderPipeline {
  private readonly callbacks = new Map<RenderStage, Set<RenderCallback>>();

  constructor() {
    for (const stage of renderStageOrder) {
      this.callbacks.set(stage, new Set());
    }
  }

  addHook(stage: RenderStage, callback: RenderCallback): () => void {
    this.callbacks.get(stage)!.add(callback);
    return () => this.callbacks.get(stage)!.delete(callback);
  }

  render(layers: Iterable<RenderLayer>): void {
    const requestedLayers = new Set(layers);
    if (requestedLayers.size === 0) return;

    for (const stage of renderStageOrder) {
      if (!this.shouldRunStage(stage, requestedLayers)) continue;

      for (const callback of this.callbacks.get(stage)!) {
        callback();
      }
    }
  }

  private shouldRunStage(stage: RenderStage, layers: Set<RenderLayer>) {
    return stage === "beforeDraw" || stage === "afterDraw" || layers.has(stage);
  }
}
