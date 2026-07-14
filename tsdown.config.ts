import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "./src/index.ts",
    core: "./src/core.ts",
    extensions: "./src/extensions.ts",
    engine: "./src/engine.ts",
    "controllers/area": "./src/controllers/area-controller.ts",
    "controllers/bar": "./src/controllers/bar-controller.ts",
    "controllers/candle": "./src/controllers/candle-controller.ts",
    "controllers/hlc-area": "./src/controllers/hlc-area-controller.ts",
    "controllers/hollow-candle":
      "./src/controllers/hollow-candle-controller.ts",
    "controllers/line": "./src/controllers/line-controller.ts",
    "controllers/stepline": "./src/controllers/step-line-controller.ts",
  },
  platform: "browser",
  dts: true,
  sourcemap: true,
});
