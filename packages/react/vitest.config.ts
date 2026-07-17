import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@ardinsys\/financial-charts\/extensions$/,
        replacement: fileURLToPath(
          new URL("../core/src/extensions.ts", import.meta.url)
        ),
      },
      {
        find: /^@ardinsys\/financial-charts$/,
        replacement: fileURLToPath(
          new URL("../core/src/index.ts", import.meta.url)
        ),
      },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
