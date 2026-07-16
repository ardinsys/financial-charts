# Changelog

## 1.0.0 - 2026-07-09

### Breaking Changes

- Switched the X-axis from continuous elapsed time to ordinal bar-index
  projection, so weekends, holidays, and missing bars collapse instead of
  leaving blank horizontal gaps.
- Reworked visible range, zoom, and pan internals around fractional index
  windows. Persist application-level range state and prefer
  `getVisibleTimeRange()` / `getVisibleLogicalRange()` over removed zoom/pan
  scalar helpers.
- Replaced old render invalidation with named render layers:
  `"grid"`, `"axes"`, `"series"`, `"indicators"`, `"drawings"`,
  `"annotations"`, and `"crosshair"`. Removed the `"controller"` alias.
- Removed global controller/indicator registries. Built-in controllers are
  instance-registered by default; custom controllers are passed in chart options
  or registered with `chart.registerController(...)`.
- Removed `FinancialChart.createIndicator()`. Instantiate indicators directly
  with `new MyIndicator(...)` and pass them to `chart.addIndicator(...)`.
- Migrated indicators to the plugin lifecycle and data-driven labels. Custom
  indicators now implement `getLabelContent()` instead of mutating label DOM in
  `updateLabel()`; downstream indicator packages should migrate their label
  code to `IndicatorLabelContent`.
- Removed the old public `Indicator.setChart()` hook; the base `attach(ctx)`
  lifecycle now owns chart/context setup.
- Replaced indicator label templates/renderers with `ChartDOMAdapter` label
  models. Use the default `fci-*` CSS hooks or provide a custom DOM adapter.
- Renamed extent APIs to scale APIs (`createScale`, `getVisibleScale`,
  `DataScaleModel`) and removed old zoom/pan projection options.
- Removed the old `draw`, `drawNextPoint`, and `updateCoreOptions` chart methods.
  Use `setData`, `updateData`, and `updateOptions` respectively.

### Added

- `setData`, `updateData`, and `clearData` provide explicit replacement,
  streaming, and clearing behavior, including safe stream-first initialization.
- `DataStore` for sorted bar storage, binary lookup, merge, and visible slicing.
- Engine exports: `Scale`, `TimeScale`, `PriceScale`, `DataScaleModel`, price
  tick helpers, and `TimeTickGenerator`.
- `RenderPipeline` with ordered render stages and hook registration.
- `Pane` model for pane geometry, price scales, pane-aware Y-axis rendering, and
  draggable pane dividers.
- Extension exports: `ChartPlugin`, `ChartContext`, `ChartPointerEvent`,
  `Drawable`, indicators, drawings, annotations, and DOM-adapter contracts.
- Root event exports: `ChartEventMap` and generic `EventEmitter`.
- Drawing tools: `DrawingManager`, `Drawing`, `TrendLine`, `HorizontalLine`,
  `RectangleDrawing`, and `TextDrawing`.
- Drawing persistence through `DrawingManager.toJSON()` /
  `DrawingManager.fromJSON()`.
- Drawing keyboard controls for delete, undo, and redo through
  `DrawingManager`.
- Drawing events: `drawing-create`, `drawing-change`, `drawing-finished`,
  `drawing-select`, and `drawing-delete`.
- `ChartDOMAdapter` through the extensions entry and root-exported
  `DefaultDOMAdapter` for replacing or restyling DOM chrome such as indicator
  labels/actions and pane dividers.
- `updateLocalization({ locale, timeZone, formatter, localeValues })` for
  cohesive runtime locale, timezone, formatter, and UI-string updates.
- Seconds and sub-minute time tick coverage in `DefaultFormatter` and
  `TimeTickGenerator`.
- `MIGRATION.md` plus expanded guide/reference documentation for v1 extension
  APIs.
- Versioned chart state through `toJSON()` / `restoreState()`, including precise
  visible windows, pane layout, indicator resolvers, and plugin contributors.
- Curated `core`, `extensions`, and `engine` package entry points plus concrete
  controller subpaths.

### Changed

- Constructor-supplied custom controllers are additive to built-ins by default;
  set `includeDefaultControllers: false` for an exact set.
- Added a controller-neutral `core` entry and per-controller entry points so
  bundlers can exclude unused built-in controllers while the root chart retains
  its convenient built-in set.
- `getOptions()` returns a stable borrowed readonly configuration snapshot
  instead of the chart's mutable internal options object.
- `getData()`, `getPanes()`, `getIndicators()`, and `getPlugins()` return
  borrowed readonly snapshots without per-read copying. Duplicate extension
  registrations are rejected, add methods return idempotent disposers, and
  chart disposal is idempotent.
- Full datasets are copied and sorted before bucket merging. Streaming accepts
  equal or newer timestamps and rejects older corrections with guidance to use
  `setData`.
- Logical-index, whole-bar time, and precise time-window setters now share one
  clamped view mutation that synchronously rescales, notifies once, and redraws
  all dependent layers.
- Built-in controllers are registered on each chart instance by default, keeping
  hello-world chart setup small while avoiding global mutable registries.
- Indicator authoring now centers on `getDrawingContext()` for overlays and
  `drawPane(context)` for paneled indicators, reducing canvas/axis boilerplate.
- Pointer-created drawings stay selected after completion, clear the active
  drawing factory, and emit `drawing-finished` plus final `drawing-select`
  payloads to chart listeners and plugins.
- Active drawing tools consume pointer drags so the chart does not pan while a
  drawing is being created or edited.
- Drawing tools ignore right-click / non-primary mouse gestures.
- Drawing anchor indexes snap to whole bar slots during pointer create and edit
  gestures.
- `drawing-select` now emits both selected drawing metadata and
  `{ drawing: undefined }` when selection is cleared.
- The drawings layer redraws during chart pan and touch zoom so annotations stay
  visually attached to bars.
- Selected drawing anchor handles can be dragged independently.
- X-axis labels now use calendar-aware ticks anchored to real bars.
- Price tick generation is shared between chart and paneled indicator axes.
- `DefaultFormatter` is SSR-safe and avoids per-frame formatter allocation in
  common tooltip paths.
- The package builds as ES modules with bundled declaration output for every
  declared entry point via `tsdown`.

### Fixed

- The documented `@ardinsys/financial-charts/style.css` export now resolves to
  the stylesheet emitted by the package build.
- Bucket merging preserves zero and safely combines close-only, nullable OHLC,
  and missing-volume points without producing `NaN` scales.
- Indicator detach paths remove label listeners and clear lifecycle resources.
- Moving average rendering uses configured theme color and clears stale caches
  when data is replaced.
- Pane heights survive layout recalculation and are clamped to pane minimums.
