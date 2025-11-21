import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "en-US",
  title: "@ardinsys/financial-charts",
  description: "Canvas-based financial charting library with a simple API.",
  lastUpdated: true,
  themeConfig: {
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
          {
            text: "View and interactions",
            link: "/guide/view-and-interactions",
          },
          {
            text: "Styling and localization",
            link: "/guide/styling-and-localization",
          },
        ],
      },
      {
        text: "Integrations",
        items: [
          { text: "Overview", link: "/integrations/overview" },
          { text: "React 16.8+", link: "/integrations/react" },
          { text: "Vue 3+", link: "/integrations/vue" },
          { text: "Svelte 3+", link: "/integrations/svelte" },
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "FinancialChart", link: "/reference/chart" },
          { text: "Indicators", link: "/reference/indicators" },
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
