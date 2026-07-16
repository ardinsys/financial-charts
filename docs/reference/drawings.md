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

Drawing IDs must be non-empty and unique within a manager. Pane IDs must be
non-negative integers, and anchor indexes/prices must be finite. Custom
`Drawing` subclasses must declare a stable `readonly type`; this is the key used
to find their deserializer.

The drawings canvas covers the complete pane stack. Each drawing is clipped to
its target pane, and the protected projection helpers return logical,
chart-local coordinates that already include the pane offset. `hitTest()`
receives coordinates in the same space.

## Manager state and attachment

Drawing state is independent of chart attachment. You can add or restore
drawings before attaching the manager:

```ts
const manager = new DrawingManager();
manager.addDrawing(
  new TrendLine({
    id: "opening-range",
    anchors: [
      { index: 10, price: 100 },
      { index: 20, price: 110 }
    ]
  })
);

chart.addPlugin(manager);
```

Removing the plugin releases keyboard and chart resources but preserves its
drawings, selection, factory, deserializers, and history. The same manager can
therefore be attached again later. One manager cannot be attached to two charts
at the same time. Detach publishes a cleared chart selection without erasing
the retained manager selection; reattachment publishes that selection again.

| Method                                      | Result                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `getDrawings()`                             | Returns a stable borrowed readonly snapshot until membership changes. |
| `getDrawingById(id)`                        | Returns one drawing by its unique ID.                                  |
| `getSelectedDrawing()`                      | Returns the selected drawing, if any.                                  |
| `addDrawing(drawing, options?)`             | Adds and selects a programmatic drawing with opt-in create emission.   |
| `upsertDrawing(json, options?)`             | Replaces or inserts serialized state by ID.                            |
| `selectDrawing(drawing?, options?)`         | Selects a managed drawing or clears selection.                         |
| `selectDrawingById(id?, options?)`          | Selects by ID; an unknown ID leaves the current selection unchanged.   |
| `deleteDrawing(drawing)` / `deleteSelected()` | Deletes with history and emits `drawing-delete`.                     |
| `removeDrawingById(id, options?)`           | Reconciliation-oriented removal with opt-in event emission.            |
| `clearDrawings(options?)`                   | Clears drawings, selection, interactions, and undo/redo history.       |
| `setDrawingFactory(factory?)`               | Arms or clears the one-shot pointer creation factory.                  |
| `registerDrawingDeserializer(type, fn)`     | Registers a loader and returns an idempotent unregister function.      |

`emit` on mutation options controls create/change/delete events and defaults to
`false`. `emitSelection` controls the separate selection event and defaults to
`true`, keeping headless selection UI synchronized. Pointer gestures and
explicit `deleteDrawing()` use interactive event semantics.

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

`fromJSON()` validates and deserializes the complete input before replacing
current state, restores the selected drawing by ID, clears history, publishes
the resulting selection, and requests one drawings-layer redraw. Duplicate IDs,
unknown types, deserializers that do not preserve ID/type, and a missing
selected ID throw without replacing the current drawing set.

To persist drawings together with controller, view, pane, and indicator state,
pass the attached manager directly to the chart state API:

```ts
const state = chart.toJSON({ contributors: [manager] });

chart.restoreState(state, {
  indicatorResolver,
  contributors: [manager]
});
```

Pane IDs are restored before drawing JSON is applied, so drawings targeting an
indicator pane remain on that pane.

Custom drawings can participate by registering a deserializer:

```ts
import { MyDrawing } from "./my-drawing";

const unregister = manager.registerDrawingDeserializer("my-drawing", (json) => {
  return new MyDrawing({
    anchors: json.anchors,
    id: json.id,
    paneId: json.paneId
  });
});

unregister();
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

Loading drawings with `fromJSON()` and clearing with default options are treated
as state reconciliation and do not emit per-drawing create/delete events.
