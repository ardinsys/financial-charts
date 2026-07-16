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

`FinancialChart` is the public facade and the coordinator for transitions that
cross multiple owners. It does not retain subsystem state that belongs to the
model, options, extensions, panes, interaction, rendering, or persistence
components listed below.

## Financial data model

`ChartData` represents one timestamped bar. A line-like series generally reads
`close`; OHLC controllers read `open`, `high`, `low`, and `close`; volume is
optional for every controller.

`ChartModel` keeps two stores:

- its source store owns validated input points at their original timestamps;
- its mapped store owns displayed points after timestamps are bucketed and merged
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
| Public option contracts | `chart-options.ts` | Constructor/update options, resolved controller options, locale values, and immutable option snapshots |
| Resolved option state | `ChartOptionsState` | Input isolation, runtime option ownership, effective update detection, controller snapshot reuse, and public snapshot identity |
| Controller registration | `ControllerRegistry` | Chart-scoped constructor identity, class defaults, lookup, and stable frozen registration snapshots |
| Chart model | `ChartModel` | Retained source bars, step-size remapping, streaming updates, logical/time view ranges, data/visible scales, and their derived snapshots |
| Bar storage | `DataStore` | Sorted immutable points, binary-search lookup, bucketing, merging, and stable data/time snapshots |
| Coordinate systems | `DataScaleModel`, `TimeScale`, `PriceScale` | Logical/time/price projection and numeric scale ranges |
| Series behavior | `ChartController`, `ChartControllerContext` | Controller-specific scale input, bar alignment, crosshair values, and primary-series drawing through a projection-only context |
| Extension lifecycle | `ExtensionHost` | Plugin/indicator registries, attachment scopes, state delivery, pointer order, annotations, and detachment |
| Extension contract | `ChartPlugin`, `ChartContext`, `IndicatorContext` | Attachment-scoped services and optional lifecycle/render callbacks |
| Change publication | `ChartChangePublisher` | Ordered extension delivery, public model-change events, and render invalidation after completed mutations |
| Indicator behavior | `Indicator`, `PaneledIndicator` | Indicator state, labels, drawing, and optional pane-specific scale/container behavior |
| Pane layout | `PaneLayout`, `Pane` | Pane identity and associations, regions, heights, dividers, resize interaction, and per-pane scales |
| Browser interaction | `InteractionController`, `CrosshairResolver`, `interaction/crosshair.ts` | Listener lifetime, gesture state, pointer normalization, shared coordinate resolution, and the public crosshair contract |
| Rendering | `ChartRenderer`, `RenderPipeline`, `chart-render-types.ts` | Canvas/context ownership, public layer contracts, DPR resizing, axes and ticks, built-in drawing stages, frame coalescing, and render hooks |
| DOM chrome | `ChartDOMAdapter` | Overlay, indicator labels/actions, and pane divider elements |
| Public events | private `EventEmitter<ChartEventMap>` | Application subscription through `FinancialChart.on()` and `off()`; internal and extension-originated publication |
| Chart persistence | `ChartStateController`, `chart-state.ts` | Serialization, restoration preparation, deferred restored views, versioned state contracts, validation, and contributor indexing |
| Extension persistence | indicator and drawing state helpers | Versioned JSON-safe indicator and drawing state plus reconstruction contracts |

## Tracing common flows

Use the public method or browser event as the entry point, then follow the owner
column rather than searching the entire facade:

| Flow | Trace |
|---|---|
| Replace or stream data | `FinancialChart.setData()` / `updateData()` → `ChartModel` → scale and pane synchronization → `ChartChangePublisher` → `ChartRenderer` |
| Pan or zoom | browser event → `InteractionController` → facade view command → `ChartModel` → `ChartChangePublisher` |
| Resolve a crosshair | browser or public crosshair command → `CrosshairResolver` → `InteractionController` state → `ChartChangePublisher` |
| Attach an extension | facade add method → `ExtensionHost` attach scope → current options, data, and visible-range delivery |
| Render a frame | change publication or `requestRedraw()` → `ChartRenderer` layer set → `RenderPipeline` stages |
| Restore state | `ChartStateController` validation and reconstruction → `FinancialChart.applyChartStateRestoration()` → one extension refresh, redraw, and public completion event |
| Dispose the chart | `FinancialChart.dispose()` → interaction → renderer stop → extensions → panes → events → renderer → DOM |

## Ownership and snapshot rules

Runtime `readonly` types express the public contract, but ownership is established
when values cross into or out of the library:

1. Retained caller input is validated and copied once.
2. Every mutable runtime value has one owner.
3. Full data and collection snapshots are created only when their owner changes.
4. Repeated reads of cached snapshots return the same frozen value until the
   corresponding state changes.
5. Extension callbacks receive the same current snapshots exposed by chart
   getters.
6. Deep cloning is reserved for foreign input and serialization boundaries, not
   repeated reads.
7. Small derived value objects may be returned by value; stable identity is not
   required unless the getter documents a snapshot contract.

### Data

`ChartModel` owns the source and mapped `DataStore` instances. `DataStore` copies
and freezes each retained point; `snapshot()` lazily creates one frozen array for
the current store version and invalidates it on append or merge.
`FinancialChart.getData()`, scale calculations, and `onData()` callbacks reuse
the model's mapped snapshot.

The visible point slice is a `ChartModel` cache rebuilt with the visible scale.
X-grid coordinates are a renderer cache. Their getters return the precomputed
arrays directly; they must not copy on each controller or indicator read.

### View ranges

`ChartModel` owns the configured time range, calculated logical bounds, and the
current fractional logical window. It performs timestamp/logical-index
conversion and range clamping. `FinancialChart` supplies viewport capacity and
controller alignment, then publishes a change only when the model reports an
effective range change.

The model also owns the full-data and visible `DataScaleModel` instances and
keeps their time scales synchronized with its current data and logical window.
The facade mirrors the shared time scale and visible price range into panes after
model changes; panes continue to own their individual price scales.

### Options

`ChartOptionsState` owns frozen copies of retained time ranges, themes, locale
values, and controller arrays. `getOptions()` returns its shallow-frozen
`ChartOptionsSnapshot`. The same snapshot is used as `previous` or `current` in
`options-change` events and is replaced only after an effective option or
controller-registration change. `FinancialChart` applies the behavioral effects
described by that change after the new resolved state is complete.
`ControllerRegistry` owns the frozen controller array, which option state reuses
directly instead of copying it at the adjacent boundary.

`formatter` and `domAdapter` are service references. Their identities are part of
the resolved snapshot, but the chart does not recursively freeze application or
adapter instances.

### Controller capabilities

Controllers receive a stable `ChartControllerContext` rather than the chart
facade. Each draw obtains one current drawing snapshot containing the main canvas,
logical size, cached visible bars, time range, pixels per bar, and projection
functions. The context cannot mutate chart-owned scales or invoke application,
extension, event, persistence, or lifecycle commands.

### Extensions and panes

`ExtensionHost` owns the plugin, overlay-indicator, and paneled-indicator frozen
arrays used as their own public snapshots. Add and remove operations replace the
affected array. The host rebuilds combined lifecycle and reverse pointer-order
snapshots when extension membership changes. `PaneLayout` owns immutable public
pane descriptors and replaces their snapshot when pane membership or effective
heights change. Raw `Pane` objects remain internal and on authoring contexts.

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
`ChartExtensionReadModel` composes model, option-state, and pane-layout reads for
extensions, so `ExtensionHost` does not proxy these queries through the chart
facade.

`ChartContext` belongs to one attachment. Its `AbortSignal`, public-event
subscriptions, render hooks, and owned price-axis annotations are released when
that attachment ends. Extensions can release an individual subscription early
through the disposer returned by the context method. It does not expose
`FinancialChart`; view, crosshair, plugin, and indicator operations are generic
extension capabilities rather than services reserved for a built-in plugin.
`ExtensionHost` receives a typed event channel and focused command object rather
than retaining the chart façade.

Indicators receive `IndicatorContext`, which contains the shared scoped
extension services plus drawing snapshots, localization, cached grid positions,
invalidation, and self-removal. It does not expose `FinancialChart` or mutable
chart scale models. `ChartIndicatorHost` composes these capabilities from the
model, renderer, extension read model, and three indicator lifecycle operations.

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

Data, view, option, and crosshair notification paths are coordinated by
`ChartChangePublisher`:

| Trigger | Extension callbacks | Public event | Render effect |
|---|---|---|---|
| `setData` / `updateData` | Data, then visible range when changed | None | All dependent layers |
| Visible-range setter or interaction | Visible range | None | View-dependent layers |
| `updateOptions` | Options, remapped data when changed, then visible range | `options-change` after extension delivery | Layers classified by changed keys |
| Crosshair movement or command | None | `crosshair-change` or `crosshair-clear` | Crosshair layer |
| Add indicator | Initial options, data, range | `indicator-add` after initial delivery | Indicator/all layers as required |
| Remove indicator | Detach and release resources | `indicator-remove` after cleanup | Indicator/all layers as required |
| Drawing completion | Drawing callback | `drawing-finished` after extension callback | Drawing-dependent layers |
| State restore | Recreated indicators receive initial state; existing plugins receive one final refresh | `state-restored` after restoration | One final full redraw |

Ordinary model mutations produce one internal change description. The publisher
delivers extension callbacks, emits public completion events, and requests
rendering last. State restoration applies the same model mutation without
committing intermediate effects, then performs its final plugin refresh and
redraw.

Public events are application observations. Direct lifecycle callbacks are the
engine-to-extension contract. New internal state propagation should not be
routed through the public emitter merely to reach engine-owned extensions.
`ChartContext.emit()` marks an extension-originated event; drawing completion
uses that path to deliver `onDrawingFinished()` before publishing the public
event. `FinancialChart` exposes subscription only; publication and listener
cleanup remain owned by its private event channel.

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
touch timers, and the current crosshair model. `CrosshairResolver` resolves both
pointer-driven and programmatic crosshairs through the chart model, pane layout,
and active controller alignment. Neither component reaches into
`FinancialChart` state.

```text
browser event
  -> InteractionController normalizes coordinates and gesture state
  -> CrosshairResolver resolves data and pane coordinates, or FinancialChart applies a view command
  -> normal change commit notifies extensions and invalidates render layers
```

Panning and zooming mutate the fractional logical range through the same chart
commands used by other callers. Once the range is clamped, the chart recalculates
the visible scale, synchronizes pane time scales and the main price scale,
notifies extensions, and invalidates view layers.

Interactive crosshair state is derived from the closest stored data point and the
pane under the pointer. Its source is explicit: mouse, touch, or programmatic.
Programmatic crosshair methods write the same model and use the same projection
and rendering state, while remaining independent of active gesture state. One
owned `{ time, y, paneId, price, dataPoint }` object is created per effective
crosshair update and reused by getters, public events, and synchronization;
the hot pointer path does not copy or freeze it.

## Rendering

`ChartRenderer` owns every chart canvas and context, logical sizing, device-pixel
ratio changes, resize observation, built-in drawing stages, and frame lifetime.
It reads model, pane, extension, and crosshair state through one render-model
interface. Rendering does not repair or recalculate model state; chart commands
make derived scales and visible-data caches current before invalidating layers.

`requestRedraw()` delegates to the renderer. One or more layers are added to a
set, so duplicate invalidations in one frame are free. Unless an immediate redraw
is requested, one animation frame flushes the accumulated set. Invalidations
raised during a render schedule a following frame.

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
`ChartContext.onRenderStage()`. `ExtensionHost` delegates extension canvas,
logical-size, render-hook, redraw, and annotation invalidation capabilities
directly to `ChartRenderer`; `FinancialChart` does not proxy those operations.

Canvas backing-store sizes use the device pixel ratio, while chart calculations
and extension-facing canvas sizes use logical pixels. Resize observers and
pending animation frames are canceled when rendering stops during chart disposal.

## State restoration

`ChartStateController` owns serialization, restoration validation and
reconstruction, contributor matching, and a restored visible range while it
waits for data. `FinancialChart` applies the prepared restoration as one visible
coordination transaction across the model, panes, extensions, and renderer.

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
   final crosshair snapshot readable, then stop renderer resize observation and
   pending frames.
3. Ask `ExtensionHost` to abort attachment scopes and detach indicators, then
   plugins. Registry snapshots remain readable during detachment so a plugin can
   persist the final chart state.
4. Clear extension collections and annotations, then dispose pane associations,
   dividers, and active pane resizing.
5. Remove public event listeners and dispose renderer canvases and hooks.
6. Destroy overlay DOM and the chart container.

Every cleanup step is attempted in this order. If more than one step fails, the
first error is rethrown after the remaining owners have released their resources.

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
