import { describe, expect, it } from "vitest";
import { paletteColor } from "../src/utils/color";

describe("paletteColor", () => {
  it("selects colors cyclically", () => {
    const colors = ["red", "green", "blue"];

    expect(paletteColor(colors, 0)).toBe("red");
    expect(paletteColor(colors, 4)).toBe("green");
  });

  it("rejects an empty palette and invalid indices", () => {
    expect(() => paletteColor([], 0)).toThrow(RangeError);
    expect(() => paletteColor(["red"], -1)).toThrow(RangeError);
    expect(() => paletteColor(["red"], 0.5)).toThrow(RangeError);
  });
});
