import { access, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageJsonUrl = new URL("../package.json", import.meta.url);
const packageJson = JSON.parse(await readFile(packageJsonUrl, "utf8"));
const packageRoot = new URL("../", import.meta.url);
const documentationRoot = new URL("../../../apps/docs/", import.meta.url);

for (const target of collectExportTargets(packageJson.exports)) {
  await access(fileURLToPath(new URL(target, packageRoot)));
}

const styleSpecifier = `${packageJson.name}/style.css`;
const styleUrl = import.meta.resolve(styleSpecifier);
await access(fileURLToPath(styleUrl));

for (const internalPath of [
  "dist/index.js",
  "dist/style.css",
  "src/core.ts",
  "src/ui/icons.ts",
]) {
  assertPackagePathNotExported(`${packageJson.name}/${internalPath}`);
}

const publicDeclarationPaths = [
  "dist/index.d.ts",
  "dist/core.d.ts",
  "dist/extensions.d.ts",
  "dist/engine.d.ts",
];
const internalRuntimeExports = [
  "restoreValidatedIndicator",
  "validateIndicatorState",
];
const bundledExtensionImplementations = [
  "ChartSyncPlugin",
  "DefaultDOMAdapter",
  "DrawingManager",
  "TrendLine",
];

for (const modulePath of ["dist/extensions.js", "dist/engine.js"]) {
  const publicModule = await import(
    new URL(`../${modulePath}`, import.meta.url)
  );
  for (const exportName of internalRuntimeExports) {
    if (exportName in publicModule) {
      throw new Error(`${exportName} must not be exported from ${modulePath}`);
    }
  }
}

const extensionsModule = await import(
  new URL("../dist/extensions.js", import.meta.url)
);
for (const exportName of bundledExtensionImplementations) {
  if (exportName in extensionsModule) {
    throw new Error(
      `${exportName} must not be exported from dist/extensions.js`
    );
  }
}

for (const declarationPath of publicDeclarationPaths) {
  const declaration = await readFile(
    new URL(`../${declarationPath}`, import.meta.url),
    "utf8"
  );
  for (const forbiddenExport of [
    "TestIndicator",
    "ICON_SHOW",
    "ICON_HIDE",
    "ICON_SETTINGS",
    "ICON_REMOVE",
    "applyDrawingAnchors",
    "defaultControllers",
    "drawNextPoint",
    ...internalRuntimeExports,
    "updateCoreOptions",
  ]) {
    if (declaration.includes(forbiddenExport)) {
      throw new Error(
        `${forbiddenExport} must not appear in ${declarationPath}`
      );
    }
  }

  for (const removedName of [
    "DataExtent",
    "Extent",
    "createIndicator",
    "createExtent",
    "drawNextPoint",
    "drawingAxisBounds",
    "getEffectiveCrosshairValues",
    "getKey",
    "getPanOffset",
    "getPixelPerMs",
    "getVisibleExtent",
    "getZoomLevel",
    "labelRenderer",
    "labelTemplate",
    "mergeThemes",
    "randomColor",
    "recalculateVisibleExtent",
    "registerIndicator",
    "rightOffset",
    "setChart",
    "setVisibleIndexRange",
    "updateCoreOptions",
    "updateLabel",
  ]) {
    if (new RegExp(`\\b${removedName}\\b`).test(declaration)) {
      throw new Error(`${removedName} must not appear in ${declarationPath}`);
    }
  }

  if (declaration.includes('"controller"')) {
    throw new Error(
      `The removed controller redraw alias appears in ${declarationPath}`
    );
  }
}

const documentationPaths = await readdir(documentationRoot, {
  recursive: true,
});
for (const documentationPath of documentationPaths) {
  if (!documentationPath.endsWith(".md")) continue;
  const documentation = await readFile(
    new URL(documentationPath, documentationRoot),
    "utf8"
  );
  if (/\bapplyDrawingAnchors\b/.test(documentation)) {
    throw new Error(
      `applyDrawingAnchors must not be documented in docs/${documentationPath}`
    );
  }
}

const extensionsDeclaration = await readFile(
  new URL("../dist/extensions.d.ts", import.meta.url),
  "utf8"
);
for (const exportName of bundledExtensionImplementations) {
  if (new RegExp(`\\b${exportName}\\b`).test(extensionsDeclaration)) {
    throw new Error(`${exportName} must not appear in dist/extensions.d.ts`);
  }
}

const rootDeclaration = await readFile(
  new URL("../dist/index.d.ts", import.meta.url),
  "utf8"
);
const exportInventory = await readFile(
  new URL("reference/exports.md", documentationRoot),
  "utf8"
);
const rootExports = [...rootDeclaration.matchAll(/export \{([^}]*)\}/gs)]
  .flatMap((match) => match[1].split(","))
  .map((name) => name.trim())
  .map((name) => name.replace(/^type\s+/, ""))
  .map((name) => name.split(/\s+as\s+/).at(-1))
  .filter(Boolean);
const undocumentedExports = rootExports.filter(
  (name) => !new RegExp(`\\b${escapeRegExp(name)}\\b`).test(exportInventory)
);

if (undocumentedExports.length > 0) {
  throw new Error(
    `Root exports missing from docs/reference/exports.md: ${undocumentedExports.join(", ")}`
  );
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

function assertPackagePathNotExported(specifier) {
  try {
    import.meta.resolve(specifier);
    throw new Error(`Internal package path must not be exported: ${specifier}`);
  } catch (error) {
    if (error?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
