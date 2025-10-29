import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "en-US",
  title: "Financial Charts",
  description: "Canvas-based financial charting library with a simple API.",
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/chart" },
      { text: "GitHub", link: "https://github.com/ardinsys/financial-charts" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Configuration", link: "/guide/configuration" },
            { text: "Theming", link: "/guide/theming" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "API Reference",
          items: [{ text: "FinancialChart", link: "/reference/chart" }],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/ardinsys/financial-charts" },
    ],
  },
});
