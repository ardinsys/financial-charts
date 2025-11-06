# Theming

Themes control colors, typography, and surface styling. Combine the shipped light and dark themes with your overrides to match your brand.

## Merge custom themes

Use `mergeThemes` to layer overrides on top of the defaults. Only override the properties you need.

```ts
import {
  defaultLightTheme,
  defaultDarkTheme,
  mergeThemes,
} from "@ardinsys/financial-charts";

const baseTheme = mergeThemes(defaultLightTheme, {
  background: {
    color: "#ffffff",
  },
  grid: {
    color: "#cccccc",
  },
});

const darkTheme = mergeThemes(defaultDarkTheme, {
  background: {
    color: "#141414",
  },
});
```

## Applying themes

Pass the theme when creating a chart or later with `updateTheme`.

```ts
chart.updateTheme(darkTheme);
```

While the chart can operate with a single theme, providing both light and dark variants allows you to respond to user preferences easily.

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
  formatter: new CustomFormatter(),
});
```

Remember to include the distributed stylesheet (`@ardinsys/financial-charts/dist/style.css`) when using indicators so the UI elements inherit the expected baseline styles.
