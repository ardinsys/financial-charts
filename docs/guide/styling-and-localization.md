# Styling and localization

Themes, locales, and formatters let you align the chart with your brand and language requirements without touching the rendering core.

## Theme anatomy

`ChartTheme` is split into predictable sections:

| Key          | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| `backgroundColor` | Canvas background color.                                               |
| `grid`       | `{ color, width }` controlling horizontal and vertical guides.              |
| `candle`, `bar`, `line`, `area`, `hlcArea` | Style specific controller types.              |
| `volume`     | Up/down fill colors for the histogram.                                      |
| `xAxis`, `yAxis` | Typography, colors, and separators for labels.                          |
| `crosshair`  | Line color/dash plus tooltip styling and info-line labels.                  |
| `randomColors` | Palette used when multiple indicators request auto colors.                |

Merge your overrides with the shipped themes – missing values are backfilled automatically.

```ts
import {
  defaultLightTheme,
  defaultDarkTheme,
  mergeThemes
} from "@ardinsys/financial-charts";

const baseTheme = mergeThemes(defaultLightTheme, {
  backgroundColor: "#ffffff",
  area: {
    color: "#2d7dff",
    fill: [
      [0, "rgba(45, 125, 255, 0.35)"],
      [1, "rgba(45, 125, 255, 0)"]
    ]
  },
  crosshair: {
    color: "#727cf5",
    tooltip: {
      backgroundColor: "#0f111b"
    }
  }
});
```

Apply themes on creation or at runtime:

```ts
chart.updateTheme(baseTheme);
```

## Responding to user preference

Detect the active color scheme and switch themes live.

```ts
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const theme = prefersDark ? defaultDarkTheme : baseTheme;

const chart = new FinancialChart(root, "auto", {
  type: "hlc-area",
  theme,
  stepSize: 15 * 60 * 1000,
  maxZoom: 150,
  volume: true
});

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (event) => {
    chart.updateTheme(event.matches ? defaultDarkTheme : baseTheme);
  });
```

## Locale and formatter overrides

Provide locale strings when constructing the chart or later with `updateLocale`. Missing values merge into built-in English defaults, so you only override what changes.

```ts
chart.updateLocale("EN", {
  EN: {
    common: {
      sources: {
        open: "Open price",
        high: "High",
        low: "Low",
        close: "Close",
        volume: "Volume"
      }
    },
    indicators: {
      actions: {
        show: "Show",
        hide: "Hide",
        settings: "Settings",
        remove: "Remove"
      }
    }
  }
});
```

For completely custom label formatting, extend the `Formatter` interface (or `DefaultFormatter`) and pass an instance to the chart:

```ts
import { DefaultFormatter, FinancialChart } from "@ardinsys/financial-charts";

class CustomFormatter extends DefaultFormatter {
  formatPrice(value: number): string {
    return `${value.toFixed(2)} USD`;
  }

  formatTooltipDate(value: number): string {
    return new Date(value).toLocaleString("en-US");
  }
}

const chart = new FinancialChart(root, "auto", {
  type: "candlestick",
  theme: baseTheme,
  locale: "EN",
  formatter: new CustomFormatter()
});
```

Remember to import `@ardinsys/financial-charts/dist/style.css` when using indicators so the UI labels inherit the base styling.
