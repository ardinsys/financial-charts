import { isPlainRecord } from "./json-state";

export function mergeObjects<T extends object>(
  defaults: T,
  overrides?: object | null
): T {
  const defaultValues = defaults as Record<string, unknown>;
  const overrideValues = (overrides ?? {}) as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const keys = new Set([
    ...Object.keys(defaultValues),
    ...Object.keys(overrideValues)
  ]);

  for (const key of keys) {
    const defaultValue = defaultValues[key];
    const overrideValue = overrideValues[key];
    const hasOverride =
      Object.hasOwn(overrideValues, key) && overrideValue !== undefined;
    const value =
      hasOverride && isPlainRecord(defaultValue) && isPlainRecord(overrideValue)
        ? mergeObjects(defaultValue, overrideValue)
        : cloneMergeValue(hasOverride ? overrideValue : defaultValue);
    Object.defineProperty(result, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  }

  return result as T;
}

function cloneMergeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneMergeValue);
  }
  if (isPlainRecord(value)) {
    return mergeObjects(value);
  }
  return value;
}
