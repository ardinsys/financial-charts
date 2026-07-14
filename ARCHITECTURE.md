# Architecture

This document describes the runtime architecture and the contracts that should
remain visible while the implementation evolves. It is primarily for maintainers
working on chart state, extensions, panes, interaction, rendering, or disposal.

## Mental model

A chart processes commands through one conceptual pipeline:

```text
public command
  -> validate input
  -> mutate owned state
  -> derive ranges, scales, panes, and crosshair state
  -> notify extensions and public listeners
  -> invalidate render layers
  -> render the accumulated layers
```

All derived state must be current before observers run. Rendering is normally
deferred to the next animation frame, so several commands in the same frame can
coalesce their invalidated layers.

`FinancialChart` is currently both the public facade and the coordinator for much
of this pipeline. The surrounding modules own the parts listed below; code should
move toward these ownership boundaries rather than adding new cross-cutting state
to the facade.

## Financial data model

`ChartData` represents one timestamped bar. A line-like series generally reads
`close`; OHLC controllers read `open`, `high`, `low`, and `close`; volume is
optional for every controller.

The chart keeps two stores:

- `originalDataStore` owns validated input points at their original timestamps.
- `dataStore` owns the displayed points after timestamps are bucketed and merged
  according to `stepSize`.

Keeping the original data allows a `stepSize` change to remap the dataset without
losing information from the caller's input.

The X axis is index based. Stored timestamps identify real bars, while the
visible logical range uses fractional bar indices. This removes visual gaps for
weekends, holidays, and missing data while still allowing smooth pan and zoom.
`TimeScale` converts between logical positions, timestamps, and pixels.

`DataScaleModel` groups the time, price, and volume scales for a dataset. The main
pane and every indicator pane share the active time scale. Each pane owns its own
price scale and Y-axis region.

## Module ownership

| Area | Current owner | Responsibility |
|---|---|---|
| Public coordination | `FinancialChart` | Validates commands and coordinates model, lifecycle, layout, interaction, and rendering effects |
| Bar storage | `DataStore` | Sorted immutable points, binary-search lookup, bucketing, merging, and stable data/time snapshots |
| Coordinate systems | `DataScaleModel`, `TimeScale`, `PriceScale` | Logical/time/price projection and visible bounds |
| Series behavior | `ChartController` implementations | Controller-specific scale input, bar alignment, crosshair values, and primary-series drawing |
| Extension lifecycle | `ExtensionHost` | Plugin/indicator registries, attachment scopes, state delivery, pointer order, annotations, and detachment |
| Extension contract | `ChartPlugin`, `ChartContext` | Attachment-scoped services and optional lifecycle/render callbacks |
| Indicator behavior | `Indicator`, `PaneledIndicator` | Indicator state, labels, drawing, and optional pane-specific scale/container behavior |
| Pane layout | `PaneLayout`, `Pane` | Pane identity and associations, regions, heights, dividers, resize interaction, and per-pane scales |
| Browser interaction | `InteractionController` | Listener lifetime, gesture state, pointer normalization, and crosshair source/state |
| Render ordering | `RenderPipeline` plus `FinancialChart` scheduler | Ordered render stages and animation-frame layer coalescing |
| DOM chrome | `ChartDOMAdapter` | Overlay, indicator labels/actions, and pane divider elements |
| Public events | `EventEmitter` and `ChartEventMap` | Application-facing chart, indicator, drawing, options, and state events |
| Persistence | chart/indicator state helpers | Versioned JSON-safe chart, indicator, drawing, and contributor state |

## Ownership and snapshot rules

Runtime `readonly` types express the public contract, but ownership is established
when values cross into or out of the library:

1. Retained caller input is validated and copied once.
2. Every mutable runtime value has one owner.
3. Full data and collection snapshots are created only when their owner changes.
4. Repeated reads return the same frozen snapshot until the corresponding state
   changes.
5. Extension callbacks receive the same current snapshots exposed by chart
   getters.
6. Deep cloning is reserved for foreign input and serialization boundaries, not
   repeated reads.

### Data

`DataStore` copies and freezes each retained point. `snapshot()` lazily creates
one frozen array for the current store version and invalidates it on append or
merge. `FinancialChart.getData()`, scale calculations, and `onData()` callbacks
reuse that array.

Visible points and X-grid coordinates are render-derived caches. Their getters
return the precomputed arrays directly; they must not copy on each controller or
indicator read.

### Options

The chart owns frozen copies of retained time ranges, themes, locale values, and
controller arrays. `getOptions()` returns one shallow-frozen
`ChartOptionsSnapshot` containing those owned values. The same snapshot is used
as `previous` or `current` in `options-change` events and is replaced only after
an effective option or controller-registration change.

`formatter` and `domAdapter` are service references. Their identities are part of
the resolved snapshot, but the chart does not recursively freeze application or
adapter instances.

### Extensions and panes

`ExtensionHost` owns the plugin, overlay-indicator, and paneled-indicator frozen
arrays used as their own public snapshots. Add and remove operations replace the
affected array. The host rebuilds combined lifecycle and reverse pointer-order
snapshots when extension membership changes. `PaneLayout` owns the pane snapshot
and replaces it when indicator panes are added or removed.

This also defines dispatch behavior: a callback loop retains the membership
snapshot from the start of the dispatch, checks that each extension is still
attached before invoking it, and does not deliver the current change to an
extension added partway through the loop.

Parameterized queries such as `getIndicatorsByType(typeId)` derive a new frozen
result. They are not persistent registries and must not retain arbitrary query
keys.

## Extension lifecycle

The intended lifecycle is:

```text
register -> attach -> receive current state -> receive changes -> detach
```

`ExtensionHost` implements the shared plugin and indicator lifecycle.
`FinancialChart` supplies explicit indicator mount and unmount hooks because
labels and panes belong to chart layout rather than the base extension contract.

`ChartContext` belongs to one attachment. Its `AbortSignal`, public-event
subscriptions, render hooks, and owned price-axis annotations are released when
that attachment ends. Extensions can release an individual subscription early
through the disposer returned by the context method.

Initial state is delivered synchronously after attachment in this order:

1. `onOptionsChanged()` with an empty `changedKeys` array and the current options
   snapshot as both `previous` and `current`.
2. `onData()` with the current mapped data snapshot.
3. `onVisibleRangeChanged()` with the current whole-bar range.

The extension may detach itself in any callback. Attachment is checked between
callbacks, so later initial-state callbacks are skipped after detachment.

Normal lifecycle iteration order is overlay indicators, paneled indicators, then
plugins, preserving registration order within each group. Pointer dispatch uses
visual stacking order: plugins newest first, paneled indicators newest first,
then overlay indicators newest first. Returning `true` from `onPointer()` consumes
the event and stops dispatch.

### Current runtime notification order

Data, view, and option notification paths are coordinated by one change commit
inside `FinancialChart`:

| Trigger | Extension callbacks | Public event | Render effect |
|---|---|---|---|
| `setData` / `updateData` | Data, then visible range when changed | None | All dependent layers |
| Visible-range setter or interaction | Visible range | None | View-dependent layers |
| `updateOptions` | Options, remapped data when changed, then visible range | `options-change` after extension delivery | Layers classified by changed keys |
| Add indicator | Initial options, data, range | `indicator-add` after initial delivery | Indicator/all layers as required |
| Remove indicator | Detach and release resources | `indicator-remove` after cleanup | Indicator/all layers as required |
| Drawing completion | Drawing callback | `drawing-finished` after extension callback | Drawing-dependent layers |
| State restore | Recreated indicators receive initial state; existing plugins receive one final refresh | `state-restored` after restoration | One final full redraw |

Data, view, and option mutations produce one internal change description. Its
commit path delivers extension callbacks, emits the public completion event,
and requests rendering last. State restoration applies the same model mutation
without committing intermediate effects, then performs its final plugin refresh
and redraw.

Public events are application observations. Direct lifecycle callbacks are the
engine-to-extension contract. New internal state propagation should not be
routed through the public emitter merely to reach engine-owned extensions.
`ChartContext.emit()` marks an extension-originated event; drawing completion
uses that path to deliver `onDrawingFinished()` before publishing the public
event. Calling `chart.emit()` itself only publishes to public listeners.

## Panes and layout

Pane `0` is always the main pane. Every paneled indicator owns exactly one
additional pane. `PaneLayout` maintains both indicator-to-pane and
pane-to-indicator maps so persistence and pointer lookup do not depend on array
position.

Layout works in logical CSS pixels:

1. Determine drawable height after the X-axis region.
2. Resolve configured or default pane heights.
3. Clamp against main-pane and indicator-pane minimums.
4. Normalize all heights to the available total.
5. Assign pane regions, resize canvases/indicators, and position dividers.

The DOM adapter renders divider elements. `PaneLayout` owns their models, DOM
handles, geometry, drag state, and window-listener lifetime. `FinancialChart`
coordinates canvas resizing and redraw after layout changes.

## Interaction

`InteractionController` owns browser listeners, mouse and touch gesture state,
touch timers, and the current crosshair model. It translates input into semantic
operations supplied by `FinancialChart`; it does not reach into chart model
fields.

```text
browser event
  -> InteractionController normalizes coordinates and gesture state
  -> FinancialChart resolves data/panes or applies a view command
  -> normal change commit notifies extensions and invalidates render layers
```

Panning and zooming mutate the fractional logical range through the same chart
commands used by other callers. Once the range is clamped, the chart recalculates
the visible scale, synchronizes pane time scales and the main price scale,
notifies extensions, and invalidates view layers.

Interactive crosshair state is derived from the closest stored data point and the
pane under the pointer. Its source is explicit: mouse, touch, or programmatic.
Programmatic crosshair methods write the same model and use the same projection
and rendering state, while remaining independent of active gesture state.

## Rendering

`requestRedraw()` accepts one layer or several layers. It adds them to a set, so
duplicate invalidations in one frame are free. Unless an immediate redraw is
requested, one animation frame flushes the accumulated set. Invalidations raised
during a render schedule a following frame.

The `RenderPipeline` visits stages in this order:

```text
beforeDraw
grid
axes
series
indicators
drawings
annotations
crosshair
afterDraw
```

Only requested render layers run. `beforeDraw` and `afterDraw` bracket every
non-empty render pass. Extensions register attachment-scoped stage hooks through
`ChartContext.onRenderStage()`.

Canvas backing-store sizes use the device pixel ratio, while chart calculations
and extension-facing canvas sizes use logical pixels.

## State restoration

Serialized state is an external boundary and is validated before runtime state
changes. Restoration temporarily suppresses frame scheduling, then:

1. Validates controllers, indicators, pane references, and contributors.
2. Removes current indicators without mutation events.
3. Applies core options without public option events or intermediate redraws.
4. Restores the visible range immediately or defers it until data exists.
5. Recreates indicators and pane identities.
6. Restores pane heights and contributor state.
7. Uses the host's normal current-state delivery to refresh existing plugins.
8. Requests one full redraw and emits `state-restored`.

State contributors must return JSON-safe values. Persistence cloning is
intentional because caller-owned serialized objects must not become runtime
state by reference.

## Disposal

Disposal is idempotent. The current ownership order is:

1. Mark the chart disposed.
2. Dispose interaction listeners, timers, and gesture state while keeping the
   final crosshair snapshot readable, then remove the chart's remaining browser
   listeners.
3. Ask `ExtensionHost` to abort attachment scopes and detach indicators, then
   plugins. Registry snapshots remain readable during detachment so a plugin can
   persist the final chart state.
4. Clear extension collections and annotations, then dispose pane associations,
   dividers, active pane resizing, and resize listeners.
5. Remove public event listeners and disconnect resize observation.
6. Destroy canvases, overlay DOM, and the chart container.

New resources must belong to one of these lifetimes: chart, pane, extension
attachment, or render frame. A resource without an explicit owner and release
point should not be added.

## Change checklist

When adding or changing behavior, verify:

- Which object owns the new state?
- Is caller input retained, and if so where is it copied?
- Which derived state must be current before callbacks run?
- Is the signal a public application event, an extension lifecycle callback, or
  a render invalidation?
- Which render layers actually depend on the change?
- Can an extension remove itself during this path?
- Which lifetime releases any listener, DOM node, annotation, or callback?
- Does a getter need a stable owner snapshot, or is it a parameterized derived
  query?
