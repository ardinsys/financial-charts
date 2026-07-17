export type JSONStateValue =
  | null
  | boolean
  | number
  | string
  | readonly JSONStateValue[]
  | { readonly [key: string]: JSONStateValue };

export type JSONStateObject = Readonly<Record<string, JSONStateValue>>;

export function cloneJSONStateObject(
  value: Record<string, unknown>,
  path: string
): JSONStateObject {
  return cloneJSONStateValue(value, path, new WeakSet()) as JSONStateObject;
}

export function cloneJSONStateValue(
  value: unknown,
  path: string,
  ancestors = new WeakSet<object>()
): JSONStateValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${path} must contain finite numbers.`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new Error(`${path} is not JSON-safe.`);
  }
  if (ancestors.has(value)) {
    throw new Error(`${path} must not contain circular values.`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return Array.from(value, (item, index) =>
        cloneJSONStateValue(item, `${path}[${index}]`, ancestors)
      );
    }
    if (!isPlainRecord(value)) {
      throw new Error(`${path} must contain plain objects.`);
    }

    const clone: Record<string, JSONStateValue> = {};
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable) continue;
      if (typeof key === "symbol" || !("value" in descriptor)) {
        throw new Error(`${path} is not JSON-safe.`);
      }
      Object.defineProperty(clone, key, {
        configurable: true,
        enumerable: true,
        value: cloneJSONStateValue(
          descriptor.value,
          `${path}.${key}`,
          ancestors
        ),
        writable: true,
      });
    }
    return clone;
  } finally {
    ancestors.delete(value);
  }
}

export function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
