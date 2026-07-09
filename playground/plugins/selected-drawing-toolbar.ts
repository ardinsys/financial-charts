import {
  DrawingManager,
  RectangleDrawing,
  TextDrawing,
  type ChartContext,
  type ChartPlugin,
  type Drawing
} from "@ardinsys/financial-charts";

export class SelectedDrawingToolbarPlugin implements ChartPlugin {
  readonly key = "playground-selected-drawing-toolbar";

  private ctx?: ChartContext;
  private root?: HTMLDivElement;
  private selectedDrawing?: Drawing;

  constructor(private readonly manager: DrawingManager) {}

  attach(ctx: ChartContext): void {
    this.ctx = ctx;
    this.root = document.createElement("div");
    this.root.className = "selected-drawing-toolbar";
    ctx.chart.getOutsideContainer().appendChild(this.root);
    this.render();
  }

  detach(): void {
    this.root?.remove();
    this.root = undefined;
    this.selectedDrawing = undefined;
  }

  setSelectedDrawing(drawing?: Drawing) {
    this.selectedDrawing = drawing;
    this.render();
  }

  private render() {
    if (!this.root) return;
    this.root.replaceChildren();

    const drawing = this.selectedDrawing;
    if (!drawing) {
      this.root.hidden = true;
      return;
    }

    this.root.hidden = false;
    this.root.append(
      this.createTitle(drawing),
      this.createStyleControls(drawing),
      this.createDeleteButton()
    );
  }

  private createTitle(drawing: Drawing) {
    const title = document.createElement("span");
    title.className = "selected-drawing-toolbar__title";
    title.textContent = drawing.type.replace("-", " ");
    return title;
  }

  private createStyleControls(drawing: Drawing) {
    const controls = document.createElement("div");
    controls.className = "selected-drawing-toolbar__controls";

    if (drawing instanceof TextDrawing) {
      controls.append(
        this.createTextInput(drawing),
        this.createColorInput(drawing, "color", "#fef3c7", "Text color"),
        this.createColorInput(
          drawing,
          "backgroundColor",
          "#111827",
          "Text background"
        )
      );
      return controls;
    }

    if (drawing instanceof RectangleDrawing) {
      controls.append(
        this.createColorInput(drawing, "strokeColor", "#c084fc", "Line color"),
        this.createColorInput(drawing, "fillColor", "#312e81", "Fill color"),
        this.createLineWidthInput(drawing)
      );
      return controls;
    }

    controls.append(
      this.createColorInput(drawing, "color", "#93c5fd", "Line color"),
      this.createLineWidthInput(drawing)
    );
    return controls;
  }

  private createTextInput(drawing: TextDrawing) {
    const input = document.createElement("input");
    input.className = "selected-drawing-toolbar__text";
    input.type = "text";
    input.value = drawing.getText();
    input.title = "Text";
    input.addEventListener("input", () => {
      drawing.setText(input.value || "Text");
      this.requestDrawingRedraw(drawing);
    });
    return input;
  }

  private createColorInput(
    drawing: Drawing,
    property: string,
    fallback: string,
    title: string
  ) {
    const input = document.createElement("input");
    const current = this.getStyleValue(drawing, property, fallback);
    input.type = "color";
    input.value = toColorInputValue(current, fallback);
    input.title = title;
    input.addEventListener("input", () => {
      this.setStyleValue(drawing, property, input.value);
    });
    return input;
  }

  private createLineWidthInput(drawing: Drawing) {
    const input = document.createElement("input");
    input.className = "selected-drawing-toolbar__range";
    input.type = "range";
    input.min = "1";
    input.max = "6";
    input.step = "1";
    input.title = "Line width";
    input.value = String(this.getStyleValue(drawing, "lineWidth", 2));
    input.addEventListener("input", () => {
      this.setStyleValue(drawing, "lineWidth", Number(input.value));
    });
    return input;
  }

  private createDeleteButton() {
    const button = document.createElement("button");
    button.className = "selected-drawing-toolbar__delete";
    button.type = "button";
    button.textContent = "Delete";
    button.addEventListener("click", () => {
      this.manager.deleteSelected();
    });
    return button;
  }

  private getStyleValue<T>(drawing: Drawing, property: string, fallback: T): T {
    const value = (drawing as unknown as Record<string, unknown>)[property];
    return value == undefined ? fallback : (value as T);
  }

  private setStyleValue(drawing: Drawing, property: string, value: unknown) {
    (drawing as unknown as Record<string, unknown>)[property] = value;
    this.requestDrawingRedraw(drawing);
  }

  private requestDrawingRedraw(drawing: Drawing) {
    this.ctx?.emit("drawing-change", { drawing });
    this.ctx?.requestRedraw(["drawings", "axes"], true);
  }
}

function toColorInputValue(value: unknown, fallback: string) {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) {
    return value;
  }
  return fallback;
}
