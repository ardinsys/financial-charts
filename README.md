# Financial charts

Canvas-based charting library for financial time series. It renders candles,
bars, lines, areas, indicators, and interactive drawings with a small,
framework-agnostic API.

## Features

- Index-based financial X-axis that collapses weekends, holidays, and missing bars.
- Candlestick, bar, hollow candle, line, step line, area, and HLC area controllers.
- Explicit replacement and streaming updates with `setData` and `updateData`.
- Overlay and paneled indicators with plugin lifecycle cleanup.
- Interactive drawings: trendline, horizontal line, rectangle, text, and JSON persistence.
- Custom controllers, plugins, themes, locales, and formatters.
- Framework agnostic ES module output.

## Installation

```bash
pnpm add @ardinsys/financial-charts
```

The package ships as an ES module and works with bundlers such as Vite, Webpack,
Rollup, or any environment that can consume modern JavaScript. When using
indicator labels, include the distributed stylesheet.

```ts
import "@ardinsys/financial-charts/style.css";
```

## Documentation

You can visit https://docs.ardinsys.eu/financial-charts for documentation.

The full guide and API reference live in `/docs`. Run `pnpm docs:dev` locally
or open the published docs site for tutorials on configuration, theming,
indicators, plugins, drawings, and controller APIs.

Planning an upgrade from 0.9.x? Read [MIGRATION.md](./MIGRATION.md).
