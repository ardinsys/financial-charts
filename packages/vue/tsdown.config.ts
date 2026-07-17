import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  platform: "browser",
  dts: true,
  sourcemap: true,
  deps: {
    neverBundle: [/^vue$/, /^@ardinsys\/financial-charts(?:\/.*)?$/],
  },
});
