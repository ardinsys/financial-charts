import { describe, expect, it } from "vitest";
import { mergeObjects } from "../src/utils/merge";

describe("mergeObjects", () => {
  it("preserves explicit null overrides and skips undefined overrides", () => {
    const result = mergeObjects(
      { nullable: "default" as string | null, retained: "default" },
      { nullable: null, retained: undefined }
    );

    expect(result).toEqual({ nullable: null, retained: "default" });
  });

  it("owns null-prototype records without changing the result prototype", () => {
    const nested = Object.assign(Object.create(null), { value: 2 });
    const overrides = JSON.parse(
      '{"__proto__":{"polluted":true}}'
    ) as Record<string, unknown>;

    const result = mergeObjects({ nested: { value: 1 } }, {
      nested,
      ...overrides
    }) as Record<string, unknown>;

    expect(result.nested).toEqual({ value: 2 });
    expect(result.nested).not.toBe(nested);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect((result.__proto__ as { polluted: boolean }).polluted).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it("ignores inherited override values", () => {
    const overrides = Object.create({ value: "inherited" }) as object;

    expect(mergeObjects({ value: "default" }, overrides)).toEqual({
      value: "default"
    });
  });
});
