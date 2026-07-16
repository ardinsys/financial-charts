import { describe, expect, it } from "vitest";
import {
  ownThemeRegistry,
  resolveChartTheme
} from "../src/chart/theme-registry";
import {
  defaultDarkTheme,
  defaultLightTheme,
  type ChartThemeMap
} from "../src/chart/themes";

describe("theme registry", () => {
  it("resolves a definition from its declared base", () => {
    const randomColors = ["#123456"];
    const fill: Array<[number, string]> = [
      [0, "#abcdef"],
      [1, "#fedcba"]
    ];
    const themes = ownThemeRegistry({
      custom: {
        base: "dark",
        grid: { width: 0 },
        randomColors,
        area: { fill }
      }
    });
    const theme = resolveChartTheme("custom", themes);

    randomColors[0] = "#000000";
    fill[0][1] = "#000000";

    expect(theme.key).toBe("custom");
    expect(theme.base).toBe("dark");
    expect(theme.grid).toEqual({
      color: defaultDarkTheme.grid.color,
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
    expect(defaultDarkTheme.key).toBe("dark");
    expect(defaultDarkTheme.grid.width).toBe(1);
  });

  it("resolves each key independently instead of merging into the active theme", () => {
    const themes: ChartThemeMap = {
      dark: { grid: { width: 4 } },
      light: { line: { width: 3 } }
    };

    const dark = resolveChartTheme("dark", themes);
    const light = resolveChartTheme("light", themes);

    expect(dark.backgroundColor).toBe(defaultDarkTheme.backgroundColor);
    expect(dark.grid.width).toBe(4);
    expect(light.backgroundColor).toBe(defaultLightTheme.backgroundColor);
    expect(light.grid.width).toBe(defaultLightTheme.grid.width);
    expect(light.line.width).toBe(3);
  });

  it("rejects an unregistered custom key", () => {
    expect(() => resolveChartTheme("missing", {})).toThrow(
      'Theme "missing" is not registered.'
    );
  });
});
