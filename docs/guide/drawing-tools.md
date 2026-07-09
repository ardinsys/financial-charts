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

## Built-in tools

- `TrendLine` uses two data-space anchors.
- `HorizontalLine` uses the latest anchor price and spans the pane width.
- `RectangleDrawing` uses two opposite corners.
- `TextDrawing` uses an anchor plus editable text via `getText()` and
  `setText()`.

All tools use `{ index, price }` anchors so they stay attached to bars while the
chart pans, zooms, or collapses calendar gaps.

## Selection, deletion, and events

```ts
chart.on("drawing-select", ({ drawing }) => {
  console.log("selected", drawing.id);
});

chart.on("drawing-change", ({ drawing }) => {
  console.log("changed", drawing.getAnchors());
});

manager.deleteSelected();
```

The drawing events are:

| Event            | When it fires                                    |
| ---------------- | ------------------------------------------------ |
| `drawing-create` | A pointer-created drawing is finalized.          |
| `drawing-change` | A drawing is changed while creating or dragging. |
| `drawing-select` | A drawing becomes selected through the manager.  |
| `drawing-delete` | A drawing is removed through the manager.        |

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
} from "@ardinsys/financial-charts";

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
