import { messages, type SiteLocale } from "~/data/messages";

export function useSiteLocale() {
  const { locale: routedLocale } = useI18n();
  const locale = computed<SiteLocale>(() =>
    routedLocale.value in messages ? (routedLocale.value as SiteLocale) : "en"
  );
  const copy = computed(() => messages[locale.value]);

  return { copy, locale };
}
