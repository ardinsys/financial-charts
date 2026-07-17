import { defineConfig } from "vitepress";

// Syntax palette from the showcase code specimen
// (apps/showcase/app/assets/css/main.css).
const showcaseCodeTheme = {
  name: "ardinsys-showcase",
  type: "dark" as const,
  colors: {
    "editor.background": "#061119",
    "editor.foreground": "#cfe0ea",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#58727e", fontStyle: "italic" },
    },
    {
      scope: ["keyword", "storage.type", "storage.modifier", "entity.name.tag"],
      settings: { foreground: "#ff6670" },
    },
    {
      scope: ["string", "punctuation.definition.string"],
      settings: { foreground: "#83c9ba" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.function",
        "support.type",
        "support.class",
        "support.function",
      ],
      settings: { foreground: "#73bdf2" },
    },
    {
      scope: ["entity.other.attribute-name", "variable.other.property"],
      settings: { foreground: "#d9a86c" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#c99bff" },
    },
    {
      scope: ["punctuation", "meta.brace"],
      settings: { foreground: "#829aa6" },
    },
  ],
};

export default defineConfig({
  lang: "en-US",
  title: "Financial charts",
  description: "Canvas-based financial charting library with a simple API.",
  base: "/financial-charts",
  lastUpdated: true,
  head: [
    [
      "link",
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/financial-charts/favicon.svg",
      },
    ],
    ["meta", { name: "theme-color", content: "#0b1720" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    [
      "link",
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    ],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Roboto+Mono:wght@400;500;600&display=swap",
      },
    ],
  ],
  markdown: {
    theme: showcaseCodeTheme,
  },
  themeConfig: {
    logo: { light: "/logo-light.svg", dark: "/logo-dark.svg" },
    siteTitle: "Charts",
    nav: [
      { text: "Guide", link: "/guide/quick-start" },
      { text: "Integrations", link: "/integrations/overview" },
      { text: "Reference", link: "/reference/chart" },
      { text: "GitHub", link: "https://github.com/ardinsys/financial-charts" },
    ],
    sidebar: [
      { text: "Introduction", link: "/introduction" },
      {
        text: "Guide",
        items: [
          { text: "Quick start", link: "/guide/quick-start" },
          { text: "Data and updates", link: "/guide/data-and-updates" },
          { text: "Custom indicators", link: "/guide/custom-indicators" },
          {
            text: "View and interactions",
            link: "/guide/view-and-interactions",
          },
          { text: "Drawing tools", link: "/guide/drawing-tools" },
          {
            text: "State and persistence",
            link: "/guide/state-and-persistence",
          },
          { text: "i18n", link: "/guide/i18n" },
          {
            text: "Styling and localization",
            link: "/guide/styling-and-localization",
          },
          {
            text: "Design-system adapter",
            link: "/guide/design-system-adapter",
          },
        ],
      },
      {
        text: "Integrations",
        items: [
          { text: "Overview", link: "/integrations/overview" },
          { text: "React 16.8+", link: "/integrations/react" },
          { text: "Vue 3+", link: "/integrations/vue" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "FinancialChart", link: "/reference/chart" },
          { text: "Public exports", link: "/reference/exports" },
          { text: "Indicators", link: "/reference/indicators" },
          { text: "Drawings", link: "/reference/drawings" },
          { text: "Plugins", link: "/reference/plugins" },
          { text: "Engine", link: "/reference/engine" },
          { text: "Scales", link: "/reference/scales" },
          { text: "DOM adapter", link: "/reference/dom-adapter" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/ardinsys/financial-charts" },
    ],
    footer: {
      message: "Released under the Apache 2.0 License.",
      copyright: "© 2025 Ardinsys",
    },
  },
});
