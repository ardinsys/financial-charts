import type { DrawingSelectionEvent } from "../chart/event-emitter";
import type { Drawing } from "../drawings/drawing";
import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";

export type DrawingSelectionCallback = (
  drawing: Drawing | undefined,
  event: DrawingSelectionEvent
) => void;

export interface DrawingSelectionPluginOptions {
  onSelect?: DrawingSelectionCallback;
}

const noop: DrawingSelectionCallback = () => {};

export class DrawingSelectionPlugin implements ChartPlugin {
  readonly key = "drawing-selection";

  private readonly onSelect: DrawingSelectionCallback;
  private selectedDrawing?: Drawing;
  private unsubscribe?: () => void;

  constructor(
    options: DrawingSelectionPluginOptions | DrawingSelectionCallback = {}
  ) {
    this.onSelect =
      typeof options === "function" ? options : (options.onSelect ?? noop);
  }

  attach(ctx: ChartContext): void {
    this.unsubscribe = ctx.on("drawing-select", (event) => {
      this.selectedDrawing = event.drawing;
      this.onSelect(event.drawing, event);
    });
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.selectedDrawing = undefined;
  }

  getSelectedDrawing() {
    return this.selectedDrawing;
  }
}
