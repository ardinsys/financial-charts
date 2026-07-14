import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "en-US",
  title: "Financial charts",
  description: "Canvas-based financial charting library with a simple API.",
  base: "/financial-charts",
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/quick-start" },
      { text: "Integrations", link: "/integrations/overview" },
      { text: "Reference", link: "/reference/chart" },
      { text: "GitHub", link: "https://github.com/ardinsys/financial-charts" }
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
            link: "/guide/view-and-interactions"
          },
          { text: "Drawing tools", link: "/guide/drawing-tools" },
          {
            text: "State and persistence",
            link: "/guide/state-and-persistence"
          },
          { text: "i18n", link: "/guide/i18n" },
          {
            text: "Styling and localization",
            link: "/guide/styling-and-localization"
          },
          {
            text: "Design-system adapter",
            link: "/guide/design-system-adapter"
          }
        ]
      },
      {
        text: "Integrations",
        items: [
          { text: "Overview", link: "/integrations/overview" },
          { text: "React 16.8+", link: "/integrations/react" },
          { text: "Vue 3+", link: "/integrations/vue" }
        ]
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
          { text: "DOM adapter", link: "/reference/dom-adapter" }
        ]
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/ardinsys/financial-charts" }
    ],
    footer: {
      message: "Released under the Apache 2.0 License.",
      copyright: "© 2025 Ardinsys"
    }
  }
});
