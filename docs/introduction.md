# Introduction

`@ardinsys/financial-charts` is a canvas-first charting engine for financial time series. It keeps rendering, zooming, and streaming data responsive while staying small and framework agnostic.

## Design goals

- **Fast on real data**: tuned for large intraday feeds, with debounced drawing and sensible defaults for trading UX (crosshair, volume, zoom/pan).
- **Predictable API**: explicit `stepSize`, index-based bars that collapse calendar gaps, immutable inputs, and clear lifecycle hooks (`draw`, `drawNextPoint`, events) so you always know when state changes.
- **Extensible**: register custom controllers, indicators, plugins, and drawing tools without forking the library – expose formatters, themes, and locale labels for branding.
- **Minimal surface area**: no runtime dependencies, ES module output, and primitive DOM requirements (a single container element).

## What you can build

- Real-time price charts with candlesticks, bars, or line/area series.
- Multi-pane layouts with overlay or paneled indicators.
- Interactive drawings such as trendlines, horizontal lines, rectangles, and text.
- Themed experiences that respect light/dark toggles and locale-aware labels.
- Custom controllers that map proprietary data onto the shared time axis.

## What this library is not

- A hosted charting platform or collaboration service – persistence hooks are provided, but storage belongs to your application.
- A full UI kit – you bring surrounding controls and state management.
