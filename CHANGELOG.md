# Changelog

## Unreleased

### Breaking Changes

- Switched the X-axis from continuous elapsed time to ordinal bar-index
  projection, so weekends, holidays, and missing bars collapse instead of
  leaving blank horizontal gaps.
- Reworked visible range, zoom, and pan internals around fractional index
  windows. Prefer `getVisibleTimeRange()` for public UI state and avoid
  persisting older zoom/pan scalar values.
- Replaced old render invalidation with named render layers:
  `"grid"`, `"axes"`, `"series"`, `"indicators"`, `"drawings"`, and
  `"crosshair"`. The `"controller"` alias still invalidates grid/axes/series.
- Moved custom overlays to the `ChartPlugin` lifecycle and added
  attach/data/range/pointer/draw/detach hooks.
- Migrated indicators onto the plugin lifecycle and pane model. Custom
  indicators should use chart scale and pane helpers instead of removed extent
  internals.
- Added explicit formatter options for locale, timezone, date/time formats,
  number formats, and volume formatting.

### Added

- `DataStore` for sorted bar storage, binary lookup, merge, and visible slicing.
- Scale exports: `Scale`, `TimeScale`, `PriceScale`, `DataScaleModel`, price
  tick helpers, and `TimeTickGenerator`.
- `RenderPipeline` with ordered render stages and hook registration.
- `Pane` model for pane geometry, price scales, and pane-aware Y-axis rendering.
- Plugin exports: `ChartPlugin`, `ChartContext`, `ChartPointerEvent`, and
  `Drawable`.
- Drawing tools: `DrawingManager`, `Drawing`, `TrendLine`, `HorizontalLine`,
  `RectangleDrawing`, and `TextDrawing`.
- Drawing persistence through `DrawingManager.toJSON()` /
  `DrawingManager.fromJSON()`.
- Drawing events: `drawing-create`, `drawing-change`, `drawing-select`, and
  `drawing-delete`.
- `MIGRATION.md` and expanded guide/reference documentation for v1 APIs.

### Changed

- X-axis labels now use calendar-aware ticks anchored to real bars.
- Price tick generation is shared between chart and paneled indicator axes.
- Indicator labels can use an injectable `labelRenderer` or `labelTemplate`.
- `DefaultFormatter` is SSR-safe and avoids per-frame formatter allocation in
  common tooltip paths.

### Fixed

- Indicator detach paths remove label listeners and clear lifecycle resources.
- Moving average rendering uses configured theme color and clears stale caches
  when data is replaced.
