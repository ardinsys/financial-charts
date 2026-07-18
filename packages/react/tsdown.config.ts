import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  platform: "browser",
  dts: {
    tsconfig: "./tsconfig.build.json",
  },
  sourcemap: true,
  // Next.js App Router: the component uses hooks, so the built entry must
  // declare itself a client module.
  outputOptions: {
    banner: '"use client";',
  },
  deps: {
    neverBundle: [
      /^react$/,
      /^react-dom(?:\/.*)?$/,
      /^@ardinsys\/financial-charts(?:\/.*)?$/,
    ],
  },
});
