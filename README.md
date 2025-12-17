# Financial charts

**Still in BETA.**

Canvas based charting library for price charts with a dead simple API, which supports themes, custom locales or even a full custom formatter for dates and prices. Still optimized for trading applications, keeping the bundle tiny (16.5 kB gzipped, no third party dependencies) and exposing hooks for controllers, themes, locales and formatters.

## Features

- more than fast enough
- small (16.5 kB gzipped) (no 3rd party dependencies)
- framework agnostic
- touch support
- zooming, panning
- your data will be automatically mapped to the given step size
- extendable with your own controllers (library is built to support financial charts, time based X axis with number based Y, keep this in mind while we are talking about extensibility)
- you can make custom themes, or use the default light/dark theme
- you can change the locale or you can even replace the whole formatter
- indicators (currently there isn't any premade indicator in this repository, just a test SMA)
- paneled indicators (currently there isn't any premade indicator in this repository)

## Installation

```bash
pnpm add @ardinsys/financial-charts
```

The package ships as an ES module and works with bundlers such as Vite, Webpack, Rollup, or any environment that can consume modern JavaScript. When using indicators, remember to include the distributed stylesheet.

## Documentation

You can visit https://docs.ardinsys.eu/financial-charts for documentation.

The full guide and API reference live in `/docs`. Run `pnpm docs:dev` locally or open the published docs site (if available) for in-depth tutorials on configuration, theming, indicators, and the controller API.
