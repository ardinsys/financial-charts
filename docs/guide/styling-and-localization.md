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

## Wiring an i18n bundle to the chart

If you already have a localization bundle (for example from `@ardinsys/intl`), forward the same messages to the chart so indicator UI strings stay consistent with the rest of the app. The chart merges your bundle with its built-in English defaults under the `default` key.

```ts
import { createIntl } from "@ardinsys/intl";
import { FinancialChart } from "@ardinsys/financial-charts";

const { locale, setLocale, t } = createIntl("en", {
  en: {
    messages: {
      common: {
        sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" }
      },
      indicators: {
        actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" }
      }
    }
  },
  hu: {
    messages: {
      common: {
        sources: { open: "Nyitó", high: "Max", low: "Min", close: "Záró", volume: "Forgalom" }
      },
      indicators: {
        actions: { show: "Megjelenítés", hide: "Elrejtés", settings: "Beállítás", remove: "Törlés" }
      }
    }
  }
});

const chart = new FinancialChart(root, "auto", {
  type: "candlestick",
  stepSize: 15 * 60 * 1000,
  maxZoom: 150,
  volume: true,
  locale: "en",
  localeValues: {
    default: {
      indicators: { actions: { show: "Show", hide: "Hide", settings: "Settings", remove: "Remove" } },
      common: { sources: { open: "Open", high: "High", low: "Low", close: "Close", volume: "Volume" } }
    }
  }
});

// Keep chart labels in sync with the active app locale
function switchLocale(nextLocale: string) {
  setLocale(nextLocale);
  chart.updateLocale(nextLocale, {
    [nextLocale]: {
      indicators: {
        actions: {
          show: t("indicators.actions.show"),
          hide: t("indicators.actions.hide"),
          settings: t("indicators.actions.settings"),
          remove: t("indicators.actions.remove")
        }
      },
      common: {
        sources: {
          open: t("common.sources.open"),
          high: t("common.sources.high"),
          low: t("common.sources.low"),
          close: t("common.sources.close"),
          volume: t("common.sources.volume")
        }
      }
    }
  });
}
```

The chart will pick the matching locale key or fall back to the `default` block when a translation is missing.

## Custom formatter that delegates to your i18n toolkit

`Formatter` methods control every label rendered by the chart. You can forward formatting calls to your own toolkit to share currency and date rules across the app.

```ts
import { DefaultFormatter, type Formatter } from "@ardinsys/financial-charts";
import { createIntl } from "@ardinsys/intl";

const intl = createIntl("en", {
  en: { numberFormats: { money: { style: "currency", currency: "USD" } } },
  hu: { numberFormats: { money: { style: "currency", currency: "HUF" } } }
});

class IntlFormatter extends DefaultFormatter implements Formatter {
  formatTooltipPrice(price: number, decimals: number): string {
    return intl.n("money", Number(price.toFixed(decimals)));
  }

  formatTooltipDate(timestamp: number): string {
    return intl.d(new Date(timestamp));
  }

  setLocale(locale: string): void {
    intl.setLocale(locale);
    super.setLocale(locale); // keep axis/volume formatters in sync
  }
}

const chart = new FinancialChart(root, "auto", {
  type: "candlestick",
  stepSize: 5 * 60 * 1000,
  maxZoom: 200,
  formatter: new IntlFormatter(),
  locale: "en"
});
```

## Theme keys and indicator labels

Themes carry a `key` (`"light"` / `"dark"` by default). Indicator label templates are selected by this key: `labelTemplate[chart.getOptions().theme.key]`. If you provide a custom theme with a different key, add a matching template entry so buttons and labels render correctly.
