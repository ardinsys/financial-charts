import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  platform: "browser",
  dts: {
    tsconfig: "./tsconfig.build.json",
  },
  sourcemap: true,
  deps: {
    neverBundle: [
      /^react$/,
      /^react-dom(?:\/.*)?$/,
      /^@ardinsys\/financial-charts(?:\/.*)?$/,
    ],
  },
});
