export function mergeObjects<T extends object>(
  defaults: T,
  overrides?: object | null
): T {
  if (overrides == null) return { ...defaults };

  const defaultValues = defaults as Record<string, unknown>;
  const overrideValues = overrides as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  const keys = new Set([
    ...Object.keys(defaultValues),
    ...Object.keys(overrideValues)
  ]);

  for (const key of keys) {
    const defaultValue = defaultValues[key];
    const overrideValue = overrideValues[key];
    result[key] =
      isPlainObject(defaultValue) && isPlainObject(overrideValue)
        ? mergeObjects(defaultValue, overrideValue)
        : (overrideValue ?? defaultValue);
  }

  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.getPrototypeOf(value)?.constructor === Object;
}
