import { mergeObjects } from "../utils/merge";
import {
  defaultDarkTheme,
  defaultLightTheme,
  type BuiltInChartThemeKey,
  type ChartTheme,
  type ChartThemeKey,
  type ChartThemeMap,
  type ResolvedChartTheme
} from "./themes";

export function ownThemeRegistry(themes?: ChartThemeMap): ChartThemeMap {
  return structuredClone(themes ?? {});
}

export function resolveChartTheme(
  key: ChartThemeKey,
  themes: ChartThemeMap
): ResolvedChartTheme {
  const definition = themes[key];
  const builtInKey = getBuiltInThemeKey(key);
  if (!definition && !builtInKey) {
    throw new Error(`Theme "${key}" is not registered.`);
  }

  const baseKey = definition?.base ?? builtInKey ?? "light";
  const base = baseKey === "dark" ? defaultDarkTheme : defaultLightTheme;
  const values = omitBase(definition);
  return {
    ...mergeObjects(base, values),
    key,
    base: baseKey
  };
}

function getBuiltInThemeKey(
  key: ChartThemeKey
): BuiltInChartThemeKey | undefined {
  return key === "light" || key === "dark" ? key : undefined;
}

function omitBase(theme?: ChartTheme): Omit<ChartTheme, "base"> | undefined {
  if (!theme) return undefined;
  const { base: _base, ...values } = theme;
  return values;
}
