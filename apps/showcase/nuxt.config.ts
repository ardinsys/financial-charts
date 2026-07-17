export default defineNuxtConfig({
  compatibilityDate: "2026-07-17",
  devtools: { enabled: true },
  modules: ["@nuxtjs/color-mode", "@nuxtjs/i18n"],
  css: ["@ardinsys/financial-charts/style.css", "~/assets/css/main.css"],
  colorMode: {
    classPrefix: "",
    classSuffix: "",
    fallback: "dark",
    preference: "system",
    storageKey: "ardin-charts-color-mode",
  },
  i18n: {
    defaultLocale: "en",
    strategy: "prefix_except_default",
    langDir: "locales",
    locales: [
      { code: "en", language: "en-US", name: "English", file: "en.ts" },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "ardin-charts-locale",
      redirectOn: "root",
    },
  },
  app: {
    head: {
      title: "ARDINSYS Charts — Financial data, drawn beautifully",
      meta: [
        { charset: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1, viewport-fit=cover",
        },
        {
          name: "description",
          content:
            "A canvas-first, extensible financial charting library by ARDINSYS.",
        },
        { name: "theme-color", content: "#0b1720" },
      ],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@400;500;600&display=swap",
        },
      ],
    },
  },
  nitro: {
    prerender: {
      routes: ["/"],
    },
  },
});
