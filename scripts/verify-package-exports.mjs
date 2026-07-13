import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
const packageRoot = new URL("../", import.meta.url);

for (const target of collectExportTargets(packageJson.exports)) {
  await access(fileURLToPath(new URL(target, packageRoot)));
}

const styleSpecifier = `${packageJson.name}/style.css`;
const styleUrl = import.meta.resolve(styleSpecifier);
await access(fileURLToPath(styleUrl));

try {
  import.meta.resolve(`${packageJson.name}/dist/style.css`);
  throw new Error("The internal dist stylesheet path must not be exported");
} catch (error) {
  if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
}

function collectExportTargets(exports) {
  const targets = new Set();

  visit(exports);
  return targets;

  function visit(value) {
    if (typeof value === "string") {
      if (value.startsWith("./")) targets.add(value);
      return;
    }

    if (value == null || typeof value !== "object") return;
    for (const nested of Object.values(value)) visit(nested);
  }
}
