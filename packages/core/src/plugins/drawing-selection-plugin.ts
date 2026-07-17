import type { DrawingSelectionEvent } from "../chart/event-emitter";
import type { Drawing } from "../drawings/drawing";
import type { DrawingManager } from "../drawings/drawing-manager";
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

  constructor(
    options: DrawingSelectionPluginOptions | DrawingSelectionCallback = {}
  ) {
    this.onSelect =
      typeof options === "function" ? options : (options.onSelect ?? noop);
  }

  attach(ctx: ChartContext): void {
    ctx.on("drawing-select", (event) => this.applySelection(event));

    const drawing = ctx
      .getPlugin<DrawingManager>("drawing-manager")
      ?.getSelectedDrawing();
    if (drawing) {
      this.applySelection({
        drawing,
        id: drawing.id,
        type: drawing.type,
        paneId: drawing.getPaneId(),
        anchors: drawing.getAnchors(),
        json: drawing.toJSON(),
      });
    }
  }

  detach(): void {
    this.selectedDrawing = undefined;
  }

  getSelectedDrawing() {
    return this.selectedDrawing;
  }

  private applySelection(event: DrawingSelectionEvent) {
    this.selectedDrawing = event.drawing;
    this.onSelect(event.drawing, event);
  }
}
