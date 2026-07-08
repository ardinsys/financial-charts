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

## Custom drawing types

Extend `Drawing`, provide a stable `type`, implement `draw()` and `hitTest()`,
and register a deserializer for persistence:

```ts
class MyDrawing extends Drawing {
  readonly type = "my-drawing";

  draw(ctx, context) {
    // render using this.getAnchors() and protected projection helpers
  }

  hitTest(point, context) {
    return false;
  }
}

manager.registerDrawingDeserializer("my-drawing", (json) => {
  return new MyDrawing({
    anchors: json.anchors,
    id: json.id,
    paneId: json.paneId
  });
});
```
