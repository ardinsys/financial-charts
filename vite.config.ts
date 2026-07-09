import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Dev-only playground. Consumes the package by source for instant HMR.
export default defineConfig({
  root: "./playground",
  plugins: [vue()],
  resolve: {
    alias: {
      "@ardinsys/financial-charts": fileURLToPath(
        new URL("./src/index.ts", import.meta.url)
      )
    }
  },
  server: {
    fs: {
      allow: [fileURLToPath(new URL(".", import.meta.url))]
    }
  }
});
