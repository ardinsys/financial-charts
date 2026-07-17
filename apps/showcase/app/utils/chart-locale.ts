import type { LocaleValuesMap } from "@ardinsys/financial-charts";
import type { SiteLocale } from "~/data/messages";

export const showcaseChartLocaleValues: LocaleValuesMap = {
  "en-US": {
    common: {
      sources: {
        open: "open",
        high: "high",
        low: "low",
        close: "close",
        volume: "volume",
      },
    },
    indicators: {
      actions: {
        show: "Show",
        hide: "Hide",
        settings: "Settings",
        remove: "Remove",
      },
    },
  },
};

const chartLocales: Record<SiteLocale, string> = { en: "en-US" };

export function showcaseChartLocale(locale: SiteLocale) {
  return chartLocales[locale];
}
