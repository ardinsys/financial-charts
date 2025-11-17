# Theming

Themes control colors, typography, and surface styling. Combine the shipped light and dark themes with your overrides to match your brand.

## Theme anatomy

The `ChartTheme` type exposes the following sections:

| Key          | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| `backgroundColor` | Canvas background color.                                               |
| `grid`       | `{ color, width }` controlling horizontal and vertical guides.              |
| `candle`, `bar`, `line`, `area`, `hlcArea` | Style specific controller types.              |
| `volume`     | Up/down fill colors for the histogram.                                      |
| `xAxis`, `yAxis` | Typography, colors, and separators for labels.                          |
| `crosshair`  | Line color/dash plus tooltip styling and info-line labels.                  |
| `randomColors` | Palette used when multiple indicators request auto colors.                |

Any missing property falls back to the defaults, which makes partial overrides straightforward.

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

const darkTheme = mergeThemes(defaultDarkTheme, {
  grid: { color: "#222637" },
  candle: {
    upColor: "#3CCF91",
    downColor: "#FF6B6B"
  }
});
```

## Applying themes

Pass the theme when creating a chart or later with `updateTheme`.

```ts
chart.updateTheme(darkTheme);
```

While the chart can operate with a single theme, providing both light and dark variants allows you to respond to user preferences easily.

### Responding to user preference

Use `matchMedia` to select a default palette and keep a reference for later toggles.

```ts
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const theme = prefersDark ? darkTheme : baseTheme;

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
    chart.updateTheme(event.matches ? darkTheme : baseTheme);
  });
```

## Locale and formatter overrides

Varying locale strings and number formatting often goes hand in hand with theming. Provide a custom formatter instance that implements the `Formatter` interface (for example by extending `DefaultFormatter`).

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

Remember to include the distributed stylesheet (`@ardinsys/financial-charts/dist/style.css`) when using indicators so the UI elements inherit the expected baseline styles. You can extend the CSS classes that start with `.fci-` to further customize indicator labels and action buttons.
