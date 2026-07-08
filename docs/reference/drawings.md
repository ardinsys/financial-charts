# Drawings

Drawings are managed by `DrawingManager`, a chart plugin that renders on the
`drawings` layer and stores anchors in data space:

```ts
import {
  DrawingManager,
  TrendLine,
  RectangleDrawing,
  TextDrawing
} from "@ardinsys/financial-charts";

const manager = new DrawingManager({
  drawingFactory: ({ anchors, paneId }) => new TrendLine({ anchors, paneId })
});

chart.addPlugin(manager);
```

## Built-in drawings

- `TrendLine`
- `HorizontalLine`
- `RectangleDrawing`
- `TextDrawing`

All built-ins persist `{ index, price }` anchors, the target `paneId`, their
`id`, drawing `type`, and drawing-specific options such as colors or text.

## Serialization

Use `toJSON()` and `fromJSON()` on the manager to persist drawings. Storage is up
to your application.

```ts
const snapshot = manager.toJSON();
localStorage.setItem("chart-drawings", JSON.stringify(snapshot));

const restored = localStorage.getItem("chart-drawings");
if (restored) {
  manager.fromJSON(JSON.parse(restored));
}
```

`fromJSON()` replaces the manager's current drawing set, restores the selected
drawing by id when present, and requests one drawings-layer redraw.

Custom drawings can participate by registering a deserializer:

```ts
class MyDrawing extends Drawing {
  readonly type = "my-drawing";
  // ...
}

manager.registerDrawingDeserializer("my-drawing", (json) => {
  return new MyDrawing({
    anchors: json.anchors,
    id: json.id,
    paneId: json.paneId
  });
});
```

## Events

Subscribe with `chart.on(...)`. Each handler receives `{ drawing }`.

| Event             | When it fires                                      |
| ----------------- | -------------------------------------------------- |
| `drawing-create`  | A pointer-created drawing is finalized.            |
| `drawing-change`  | A drawing is changed while creating or dragging.   |
| `drawing-select`  | A drawing becomes selected through the manager.    |
| `drawing-delete`  | A drawing is removed through the manager.          |

Loading drawings with `fromJSON()` is treated as state restoration and does not
emit per-drawing create/delete events.
