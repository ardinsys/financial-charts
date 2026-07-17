<script setup lang="ts">
import type { NuxtError } from "#app";
import { siteLocaleLanguages } from "~/data/messages";

const props = defineProps<{ error: NuxtError }>();

const { copy, locale } = useSiteLocale();
const requestUrl = useRequestURL();

const isNotFound = computed(() => props.error.statusCode === 404);
const statusCode = computed(() => String(props.error.statusCode ?? 500));

useHead(() => ({
  htmlAttrs: { lang: siteLocaleLanguages[locale.value] },
  title: `${statusCode.value} — ARDINSYS Charts`,
}));

function backToCharts() {
  clearError({ redirect: "/" });
}
</script>

<template>
  <div class="site-page error-page">
    <AppHeader />

    <main class="section section-grid error-section">
      <div class="hero-decor" aria-hidden="true">
        <span class="orbit orbit-one" />
        <span class="orbit orbit-two" />
        <span class="red-vector vector-one" />
        <span class="red-vector vector-two" />
        <span class="dot-matrix" />
      </div>

      <div class="shell error-shell">
        <p class="kicker">{{ copy.errorPage.kicker }}</p>
        <div class="error-code" aria-hidden="true">
          <template v-for="(digit, index) in statusCode" :key="index">
            <span v-if="digit === '0'">{{ digit }}</span>
            <template v-else>{{ digit }}</template>
          </template>
        </div>
        <h1>
          {{
            isNotFound
              ? copy.errorPage.notFoundTitle
              : copy.errorPage.errorTitle
          }}
        </h1>
        <p class="error-body">
          {{
            isNotFound ? copy.errorPage.notFoundBody : copy.errorPage.errorBody
          }}
        </p>
        <div class="error-actions">
          <button class="button button-primary" type="button" @click="backToCharts">
            {{ copy.errorPage.primary }}
          </button>
          <a
            class="button button-ghost"
            href="https://docs.ardinsys.eu/financial-charts/guide/quick-start.html"
          >
            {{ copy.errorPage.secondary }}
          </a>
        </div>
        <p class="error-path mono">
          {{ copy.errorPage.requested }}
          <span>{{ requestUrl.pathname }}</span>
        </p>
      </div>
    </main>

    <AppFooter />
  </div>
</template>
