<script setup lang="ts">
import { siteLocaleLanguages } from "~/data/messages";

const { locale } = useSiteLocale();

useHead(() => ({
  htmlAttrs: { lang: siteLocaleLanguages[locale.value] },
}));
</script>

<template>
  <NuxtPage />
</template>
