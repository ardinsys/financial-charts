# Introduction

`@ardinsys/financial-charts` is a canvas-first charting engine for financial time series. It keeps rendering, zooming, and streaming data responsive while staying small and framework agnostic.

## Design goals

- **Fast on real data**: tuned for large intraday feeds, with debounced drawing and sensible defaults for trading UX (crosshair, volume, zoom/pan).
- **Predictable API**: explicit `stepSize`, immutable inputs, and clear lifecycle hooks (`draw`, `drawNextPoint`, events) so you always know when state changes.
- **Extensible**: register custom controllers and indicators without forking the library – expose formatters, themes, and locale labels for branding.
- **Minimal surface area**: no runtime dependencies, ES module output, and primitive DOM requirements (a single container element).

## What you can build

- Real-time price charts with candlesticks, bars, or line/area series.
- Multi-pane layouts with overlay or paneled indicators.
- Themed experiences that respect light/dark toggles and locale-aware labels.
- Custom controllers that map proprietary data onto the shared time axis.

## What this library is not

- A hosted charting platform with persistence or annotation storage.
- A full UI kit – you bring surrounding controls and state management.
- A one-size-fits-all drawing toolkit – it is optimized for time-based financial data.
