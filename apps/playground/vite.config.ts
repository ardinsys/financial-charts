import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// Dev-only playground. Consumes the core package by source for instant HMR.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      {
        find: /^@ardinsys\/financial-charts\/extensions$/,
        replacement: fileURLToPath(
          new URL("../../packages/core/src/extensions.ts", import.meta.url)
        )
      },
      {
        find: /^@ardinsys\/financial-charts\/engine$/,
        replacement: fileURLToPath(
          new URL("../../packages/core/src/engine.ts", import.meta.url)
        )
      },
      {
        find: /^@ardinsys\/financial-charts$/,
        replacement: fileURLToPath(
          new URL("../../packages/core/src/index.ts", import.meta.url)
        )
      }
    ]
  },
  server: {
    fs: {
      allow: [fileURLToPath(new URL("../..", import.meta.url))]
    }
  }
});
