import { describe, expect, it } from "vitest";
import {
  defaultLightTheme,
  mergeThemes
} from "../src/chart/themes";

describe("mergeThemes", () => {
  it("returns a resolved deep merge without mutating the base theme", () => {
    const randomColors = ["#123456"];
    const fill: Array<[number, string]> = [
      [0, "#abcdef"],
      [1, "#fedcba"]
    ];
    const theme = mergeThemes(defaultLightTheme, {
      key: "custom",
      grid: { width: 0 },
      randomColors,
      area: { fill }
    });

    randomColors[0] = "#000000";
    fill[0][1] = "#000000";

    expect(theme.key).toBe("custom");
    expect(theme.grid).toEqual({
      color: defaultLightTheme.grid.color,
      width: 0
    });
    expect(theme.randomColors).toEqual(["#123456"]);
    expect(theme.area.fill).toEqual([
      [0, "#abcdef"],
      [1, "#fedcba"]
    ]);
    expect(theme.crosshair.lineDash).not.toBe(
      defaultLightTheme.crosshair.lineDash
    );
    expect(defaultLightTheme.key).toBe("light");
    expect(defaultLightTheme.grid.width).toBe(1);
  });
});
