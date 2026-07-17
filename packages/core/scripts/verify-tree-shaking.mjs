import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const rootEntry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
const coreEntry = fileURLToPath(new URL("../dist/core.js", import.meta.url));
const lineEntry = fileURLToPath(
  new URL("../dist/controllers/line.js", import.meta.url)
);

const minimalBundle = await bundle(`
  import { FinancialChart } from ${JSON.stringify(coreEntry)};
  import { LineController } from ${JSON.stringify(lineEntry)};
  globalThis.__financialCharts = [FinancialChart, LineController];
`);
const convenientBundle = await bundle(`
  import { FinancialChart } from ${JSON.stringify(rootEntry)};
  globalThis.__financialCharts = FinancialChart;
`);

for (const excludedController of [
  "AreaController",
  "BarController",
  "CandlestickController",
  "HLCAreaController",
  "HollowCandleController",
  "SteplineController",
]) {
  assert.equal(
    minimalBundle.includes(excludedController),
    false,
    `Core + line bundle unexpectedly contains ${excludedController}`
  );
  assert.equal(
    convenientBundle.includes(excludedController),
    true,
    `Convenience bundle is missing ${excludedController}`
  );
}

assert.equal(minimalBundle.includes("LineController"), true);

async function bundle(source) {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [
      {
        name: "virtual-tree-shaking-probe",
        resolveId(id) {
          if (id === "virtual:entry") return `\0${id}`;
        },
        load(id) {
          if (id === "\0virtual:entry") return source;
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: {
        input: "virtual:entry",
      },
    },
  });

  const outputs = Array.isArray(result) ? result : [result];
  return outputs
    .flatMap(({ output }) => output)
    .filter((item) => item.type === "chunk")
    .map((chunk) => chunk.code)
    .join("\n");
}
