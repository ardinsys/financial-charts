import { describe, expect, it } from "vitest";
import {
  defaultLightTheme,
  mergeThemes
} from "../src/chart/themes";

describe("mergeThemes", () => {
  it("returns a resolved deep merge without mutating the base theme", () => {
    const theme = mergeThemes(defaultLightTheme, {
      key: "custom",
      grid: { width: 0 },
      randomColors: ["#123456"]
    });

    expect(theme.key).toBe("custom");
    expect(theme.grid).toEqual({
      color: defaultLightTheme.grid.color,
      width: 0
    });
    expect(theme.randomColors).toEqual(["#123456"]);
    expect(defaultLightTheme.key).toBe("light");
    expect(defaultLightTheme.grid.width).toBe(1);
  });
});
