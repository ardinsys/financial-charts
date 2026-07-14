# Styling and localization

Themes, locales, and formatters let you align the chart with your brand and language requirements without touching the rendering core.

## Theme anatomy

`ChartTheme` is split into predictable sections:

| Key                                        | Description                                                    |
| ------------------------------------------ | -------------------------------------------------------------- |
| `backgroundColor`                          | Canvas background color.                                       |
| `grid`                                     | `{ color, width }` controlling horizontal and vertical guides. |
| `candle`, `bar`, `line`, `area`, `hlcArea` | Style specific controller types.                               |
| `volume`                                   | Up/down fill colors for the histogram.                         |
| `xAxis`, `yAxis`                           | Typography, colors, and separators for labels.                 |
| `priceAxisAnnotation`                      | Shared price-line and Y-axis annotation styling.               |
| `crosshair`                                | Line color/dash plus tooltip styling and info-line labels.     |
| `drawingAxisBounds`                        | Selected drawing axis-bound labels and translucent ranges.     |
| `randomColors`                             | Palette used when multiple indicators request auto colors.     |

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

`mergeThemes()` accepts a resolved theme followed by a `ChartTheme` patch and
returns a new `ResolvedChartTheme`. Nested plain objects are merged, arrays are
replaced, and `null`/`undefined` values fall back to the resolved default.

The theme's `randomColors` field is an explicit deterministic palette. Custom
indicators can select from it without coupling a utility to the chart:

```ts
import { paletteColor } from "@ardinsys/financial-charts/engine";

const color = paletteColor(chart.getTheme().randomColors, seriesIndex);
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

const chart = new FinancialChart(root, {
  timeRange: "auto",
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

## Localization and formatter overrides

Configure locale, timezone, number/date formatting, and chart UI strings together. Missing UI strings merge into built-in English defaults, so you only override what changes. For the focused i18n path, see [i18n](/guide/i18n).

```ts
const chart = new FinancialChart(root, {
  timeRange: "auto",
  type: "candle",
  stepSize: 15 * 60 * 1000,
  maxZoom: 150,
  volume: true,
  locale: "en-US",
  timeZone: "UTC",
  localeValues: {
    "en-US": {
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
  }
});

chart.updateLocalization({
  locale: "hu-HU",
  timeZone: "Europe/Budapest",
  localeValues: {
    "hu-HU": {
      common: {
        sources: {
          open: "Nyitó",
          high: "Max",
          low: "Min",
          close: "Záró",
          volume: "Forgalom"
        }
      },
      indicators: {
        actions: {
          show: "Megjelenítés",
          hide: "Elrejtés",
          settings: "Beállítás",
          remove: "Törlés"
        }
      }
    }
  }
});
```

`DefaultFormatter` accepts locale, timezone, and Intl option overrides:

```ts
import { DefaultFormatter } from "@ardinsys/financial-charts";

const formatter = new DefaultFormatter({
  locale: "en-US",
  timeZone: "UTC",
  dateTimeFormatOptions: {
    tooltipDate: { dateStyle: "medium", timeStyle: "short" },
    second: { hour: "numeric", minute: "2-digit", second: "2-digit" },
    subMinute: {
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3
    }
  },
  numberFormatOptions: {
    price: { maximumFractionDigits: 2 }
  },
  volumeFormatOptions: {
    compactThreshold: 10_000
  }
});
```

For completely custom label formatting, extend the `Formatter` interface (or `DefaultFormatter`) and pass an instance to the chart:

```ts
import { DefaultFormatter, FinancialChart } from "@ardinsys/financial-charts";

// Example: user formatter (not shipped with the library)
class CustomFormatter extends DefaultFormatter {
  formatPrice(value: number): string {
    return `${value.toFixed(2)} USD`;
  }

  formatTooltipDate(value: number): string {
    return new Date(value).toLocaleString("en-US");
  }
}

chart.updateLocalization({
  locale: "en-US",
  timeZone: "America/New_York",
  formatter: new CustomFormatter()
});
```

Remember to import `@ardinsys/financial-charts/style.css` when using indicators so the UI labels inherit the base styling. To restyle or replace indicator labels and pane dividers, see [Design-system adapter](/guide/design-system-adapter).

## Wiring an i18n bundle to the chart

If you already have a localization bundle (for example from `@ardinsys/intl`), forward the same messages to the chart so indicator UI strings stay consistent with the rest of the app. The chart merges your bundle with its built-in English defaults under the `default` key.

```ts
import { createIntl } from "@ardinsys/intl";
import { FinancialChart } from "@ardinsys/financial-charts";

const { locale, setLocale, t } = createIntl("en", {
  en: {
    messages: {
      common: {
        sources: {
          open: "Open",
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
  },
  hu: {
    messages: {
      common: {
        sources: {
          open: "Nyitó",
          high: "Max",
          low: "Min",
          close: "Záró",
          volume: "Forgalom"
        }
      },
      indicators: {
        actions: {
          show: "Megjelenítés",
          hide: "Elrejtés",
          settings: "Beállítás",
          remove: "Törlés"
        }
      }
    }
  }
});

const chart = new FinancialChart(root, {
  timeRange: "auto",
  type: "candle",
  stepSize: 15 * 60 * 1000,
  maxZoom: 150,
  volume: true,
  locale: "en"
});

// Keep chart labels in sync with the active app locale
function switchLocale(nextLocale: string, timeZone?: string) {
  setLocale(nextLocale);
  chart.updateLocalization({
    locale: nextLocale,
    timeZone,
    localeValues: {
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
    }
  });
}
```

The chart will pick the matching locale key or fall back to the `default` block when a translation is missing.

### Vue example: rebuild the chart locale bundle when the app locale changes

Use a computed value to regenerate the chart's locale bundle whenever your i18n store locale flips. This avoids relying on whichever locale was active at import time.

```vue
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watchEffect } from "vue";
import { FinancialChart } from "@ardinsys/financial-charts";
import "@ardinsys/financial-charts/style.css";
import { createIntl } from "@ardinsys/intl";

const { locale, setLocale, t } = createIntl("en", {
  en: {
    messages: {
      common: {
        sources: {
          open: "Open",
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
  },
  hu: {
    messages: {
      common: {
        sources: {
          open: "Nyitó",
          high: "Max",
          low: "Min",
          close: "Záró",
          volume: "Forgalom"
        }
      },
      indicators: {
        actions: {
          show: "Megjelenítés",
          hide: "Elrejtés",
          settings: "Beállítás",
          remove: "Törlés"
        }
      }
    }
  }
});

const container = ref<HTMLElement | null>(null);
const chart = ref<FinancialChart | null>(null);
const appTimeZone = ref("UTC");

const chartLocaleBundle = computed(() => ({
  [locale.value.toUpperCase()]: {
    common: {
      sources: {
        open: t("common.sources.open"),
        high: t("common.sources.high"),
        low: t("common.sources.low"),
        close: t("common.sources.close"),
        volume: t("common.sources.volume")
      }
    },
    indicators: {
      actions: {
        show: t("indicators.actions.show"),
        hide: t("indicators.actions.hide"),
        settings: t("indicators.actions.settings"),
        remove: t("indicators.actions.remove")
      }
    }
  }
}));

onMounted(() => {
  if (!container.value) return;

  const instance = new FinancialChart(container.value, {
    timeRange: "auto",
    type: "candle",
    stepSize: 15 * 60 * 1000,
    maxZoom: 150,
    volume: true,
    locale: locale.value.toUpperCase(),
    timeZone: appTimeZone.value
  });

  chart.value = instance;
});

watchEffect(() => {
  if (!chart.value) return;
  const nextLocale = locale.value.toUpperCase();
  chart.value.updateLocalization({
    locale: nextLocale,
    timeZone: appTimeZone.value,
    localeValues: chartLocaleBundle.value
  });
});

onBeforeUnmount(() => chart.value?.dispose());
</script>
```

Switch the intl store with `setLocale("hu")` (or any supported code) and the chart picks up the rebuilt bundle automatically.

## Custom formatter that delegates to your i18n toolkit

`Formatter` methods control every label rendered by the chart. You can forward formatting calls to your own toolkit to share currency and date rules across the app.

```ts
import { DefaultFormatter } from "@ardinsys/financial-charts";
import { createIntl } from "@ardinsys/intl";

const intl = createIntl("en", {
  en: { numberFormats: { money: { style: "currency", currency: "USD" } } },
  hu: { numberFormats: { money: { style: "currency", currency: "HUF" } } }
});

// Example: user formatter (not shipped with the library)
class IntlFormatter extends DefaultFormatter {
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

const chart = new FinancialChart(root, {
  timeRange: "auto",
  type: "candle",
  stepSize: 5 * 60 * 1000,
  maxZoom: 200,
  formatter: new IntlFormatter(),
  locale: "en",
  timeZone: "UTC"
});
```

## Theme keys and indicator labels

Themes carry a `key` (`"light"` / `"dark"` by default). Indicator labels receive this key in `IndicatorLabelModel.themeKey`, and the default DOM adapter also writes it to `data-theme-key`. Custom adapters can use that value to choose app-specific label styling.
