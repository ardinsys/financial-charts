# Theming

Themes control colors, typography, and surface styling. Combine the shipped light and dark themes with your overrides to match your brand.

## Merge custom themes

Use `mergeThemes` to layer overrides on top of the defaults. Only override the properties you need.

```ts
import {
  defaultLightTheme,
  defaultDarkTheme,
  mergeThemes
} from "@ardinsys/financial-charts";

const baseTheme = mergeThemes(defaultLightTheme, {
  background: {
    color: "#ffffff"
  },
  grid: {
    color: "#cccccc"
  }
});

const darkTheme = mergeThemes(defaultDarkTheme, {
  background: {
    color: "#141414"
  }
});
```

## Applying themes

Pass the theme when creating a chart or later with `updateTheme`.

```ts
chart.updateTheme(darkTheme);
```

While the chart can operate with a single theme, providing both light and dark variants allows you to respond to user preferences easily.

## Locale and formatter overrides

Varying locale strings and number formatting often goes hand in hand with theming. Supply custom formatters for prices and timestamps via the chart options.

```ts
const formatters = {
  price: (value: number) => `${value.toFixed(2)} USD`,
  time: (value: number) => new Date(value).toLocaleString("en-US")
};

const chart = new FinancialChart(root, "auto", {
  type: "candlestick",
  theme: baseTheme,
  locale: "EN",
  formatters
});
```

Remember to include the distributed stylesheet (`@ardinsys/financial-charts/dist/style.css`) when using indicators so the UI elements inherit the expected baseline styles.
