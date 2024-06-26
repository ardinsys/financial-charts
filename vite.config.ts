import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  esbuild: {
    target: "es2020",
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "financial-charts",
      formats: ["es"],
      fileName: () => "index.js",
    },
  },
});
