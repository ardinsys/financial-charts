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

`drawingFactory` arms the next pointer-created drawing. After that drawing is
finished, the manager clears the factory; call `setDrawingFactory()` again when
the user selects another drawing tool.

## Built-in drawings

- `TrendLine`
- `HorizontalLine`
- `RectangleDrawing`
- `TextDrawing`

All built-ins persist `{ index, price }` anchors, the target `paneId`, their
`id`, drawing `type`, and drawing-specific options such as colors or text.
Pointer-created and pointer-edited anchors snap `index` to whole bar slots while
keeping `price` continuous.

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

For a complete custom drawing class and factory, see [Drawing tools](/guide/drawing-tools#write-a-custom-drawing-tool).

## Events

Subscribe with `chart.on(...)`. Basic drawing events receive `{ drawing }`.
`drawing-select` receives `{ drawing, id, type, paneId, anchors, json }` when a
drawing is selected and `{ drawing: undefined }` when selection is cleared.
`drawing-finished` also includes `operation`, `id`, `type`, `paneId`, `anchors`,
and serialized `json`.

| Event              | When it fires                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `drawing-create`   | A pointer-created drawing is finalized.                                                         |
| `drawing-change`   | A drawing is changed while creating, dragging, or undoing/redoing movement.                     |
| `drawing-finished` | A pointer create or drag operation completes. Also sent to plugins through `onDrawingFinished`. |
| `drawing-select`   | Selection changes to a drawing or clears to `{ drawing: undefined }`.                           |
| `drawing-delete`   | A drawing is removed through the manager.                                                       |

Pointer-created drawings stay selected after they are finalized, and the active
drawing factory is cleared. Use
`manager.undo()`, `manager.redo()`, and `manager.deleteSelected()` for explicit
controls, or rely on the built-in keyboard bindings when the chart is focused:
`Ctrl/Cmd+Z`, `Ctrl+Y` / `Ctrl/Cmd+Shift+Z`, and `Delete` / `Backspace`.
When a drawing is selected, drag its visible anchor handles to adjust individual
anchors instead of moving the whole drawing.
Anchor edits snap to whole bar indexes on the time axis.
While a drawing tool or drawing edit gesture is active, pointer drags are
reserved for drawings and do not pan the chart.
Drawing gestures use the primary mouse button; right-clicks are ignored by the
drawing manager.

Loading drawings with `fromJSON()` is treated as state restoration and does not
emit per-drawing create/delete events.
