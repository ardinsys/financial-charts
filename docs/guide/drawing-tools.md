# Drawing tools

`DrawingManager` is a chart plugin for interactive annotations. It listens to
chart pointer events, creates drawings with a factory, handles selection and
drag-to-move, and renders on the `drawings` layer.

## Add a drawing manager

```ts
import {
  DrawingManager,
  TrendLine,
  HorizontalLine,
  RectangleDrawing,
  TextDrawing
} from "@ardinsys/financial-charts";

const manager = new DrawingManager({
  drawingFactory: ({ anchors, paneId }) => new TrendLine({ anchors, paneId })
});

chart.addPlugin(manager);
```

Switch tools by swapping the factory:

```ts
manager.setDrawingFactory(({ anchors, paneId }) => {
  return new RectangleDrawing({ anchors, paneId });
});
```

The factory is one-shot for pointer-created drawings. After the user finishes a
drawing, `DrawingManager` clears the active factory; call `setDrawingFactory()`
again when the user selects the next drawing tool.

## Built-in tools

- `TrendLine` uses two data-space anchors.
- `HorizontalLine` uses the latest anchor price and spans the pane width.
- `RectangleDrawing` uses two opposite corners.
- `TextDrawing` uses an anchor plus editable text via `getText()` and
  `setText()`.

All tools use `{ index, price }` anchors so they stay attached to bars while the
chart pans, zooms, or collapses calendar gaps. Pointer gestures snap anchor
indexes to whole bar slots while leaving prices continuous.

## Selection, deletion, and events

```ts
chart.on("drawing-select", ({ drawing }) => {
  console.log("selected", drawing?.id);
});

chart.on("drawing-change", ({ drawing }) => {
  console.log("changed", drawing.getAnchors());
});

manager.deleteSelected();
```

Pointer-created drawings stay selected after completion and clear the active
drawing factory. The manager binds keyboard actions to the chart host when
attached:

- `Delete` / `Backspace` removes the selected drawing.
- `Ctrl/Cmd+Z` undoes the last create, delete, or move.
- `Ctrl+Y` and `Ctrl/Cmd+Shift+Z` redo the last undone action.

Select an existing drawing to reveal its anchor handles. Drag a handle to adjust
that anchor; drag the drawing body to move the whole drawing. Anchor edits snap
to whole bar indexes on the time axis.
While a drawing tool or drawing edit gesture is active, pointer drags are
reserved for drawings and do not pan the chart.
Drawing gestures use the primary mouse button; right-clicks are ignored by the
drawing manager.

The drawing events are:

| Event              | When it fires                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `drawing-create`   | A pointer-created drawing is finalized.                                                                                                    |
| `drawing-change`   | A drawing is changed while creating, dragging, or undoing/redoing movement.                                                                |
| `drawing-finished` | A pointer create or drag operation completes with drawing id/type/pane/anchors/json.                                                       |
| `drawing-select`   | Selection changes. Payload includes `{ drawing, id, type, paneId, anchors, json }` when selected or `{ drawing: undefined }` when cleared. |
| `drawing-delete`   | A drawing is removed through the manager.                                                                                                  |

## Persist drawings

`DrawingManager` serializes built-in drawings and restores them with their ids,
pane ids, anchors, selection, and drawing-specific options.

```ts
const snapshot = manager.toJSON();
localStorage.setItem("drawings", JSON.stringify(snapshot));

const saved = localStorage.getItem("drawings");
if (saved) {
  manager.fromJSON(JSON.parse(saved));
}
```

`fromJSON()` replaces the current manager state. It is intended for loading
application state rather than replaying user actions, so it does not emit
per-drawing create/delete events.

## Write a custom drawing tool

Extend `Drawing`, provide a stable `type`, implement `draw()` and `hitTest()`, and register a deserializer when the drawing should be persisted. This example creates a price-band tool from two anchors:

```ts
import {
  Drawing,
  DrawingManager,
  type DrawingHitTestContext,
  type DrawingJSON,
  type DrawingOptions,
  type DrawingPoint,
  type DrawingRenderContext
} from "@ardinsys/financial-charts/extensions";

interface PriceBandData {
  color: string;
  label: string;
}

class PriceBandDrawing extends Drawing {
  static readonly type = "price-band";
  readonly type = PriceBandDrawing.type;

  constructor(
    options: DrawingOptions & {
      color?: string;
      label?: string;
    }
  ) {
    super(options);
    this.color = options.color ?? "rgba(37, 99, 235, 0.16)";
    this.label = options.label ?? "Price band";
  }

  private color: string;
  private label: string;

  static fromJSON(json: DrawingJSON): PriceBandDrawing {
    const data = json.data as Partial<PriceBandData> | undefined;

    return new PriceBandDrawing({
      anchors: json.anchors,
      id: json.id,
      paneId: json.paneId,
      color: data?.color,
      label: data?.label
    });
  }

  draw(ctx: CanvasRenderingContext2D, context: DrawingRenderContext): void {
    const [first, second] = this.projectAnchors(context);
    if (!first || !second) return;

    const y = Math.min(first.y, second.y);
    const height = Math.abs(second.y - first.y);
    const width = context.pane.getRegion().width;

    ctx.save();
    ctx.fillStyle = this.color;
    ctx.fillRect(0, y, width, height);
    ctx.fillStyle = this.isSelected() ? "#f59e0b" : "#1f2937";
    ctx.fillText(this.label, 8, y + 16);
    ctx.restore();
  }

  hitTest(point: DrawingPoint, context: DrawingHitTestContext): boolean {
    const [first, second] = this.projectAnchors(context);
    if (!first || !second) return false;

    const top = Math.min(first.y, second.y) - context.tolerance;
    const bottom = Math.max(first.y, second.y) + context.tolerance;

    return point.y >= top && point.y <= bottom;
  }

  protected getDataJSON(): PriceBandData {
    return { color: this.color, label: this.label };
  }
}

const manager = new DrawingManager({
  drawingFactory: ({ anchors, paneId }) =>
    new PriceBandDrawing({ anchors, paneId }),
  drawingDeserializers: {
    [PriceBandDrawing.type]: PriceBandDrawing.fromJSON
  }
});

chart.addPlugin(manager);
```

`draw()` receives the shared drawings canvas and the target pane. `hitTest()` receives pane-local pointer coordinates plus the configured tolerance. Use protected helpers such as `projectAnchors()` so drawings stay attached to index-space bars while the chart pans and zooms.
