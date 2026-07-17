import { describe, expect, it } from "vitest";
import { ExtensionThemeResolver } from "../src/plugin/extension-theme";

describe("ExtensionThemeResolver", () => {
  it("resolves custom keys from their chart base and caches the active result", () => {
    const defaults = {
      light: {
        color: "black",
        width: 1,
        nested: { opacity: 0.2, visible: true },
      },
      dark: {
        color: "white",
        width: 1,
        nested: { opacity: 0.6, visible: true },
      },
      contrast: {
        color: "cyan",
        width: 3,
        nested: { opacity: 1, visible: true },
      },
    };
    const themes = {
      dark: { width: 2, nested: { opacity: 0.8 } },
      night: { color: "gold" },
    };
    const resolver = new ExtensionThemeResolver(defaults, themes);

    defaults.dark.color = "mutated";
    themes.dark.width = 99;
    themes.night.color = "mutated";

    const dark = resolver.resolve({ key: "dark", base: "dark" });
    expect(dark).toEqual({
      color: "white",
      width: 2,
      nested: { opacity: 0.8, visible: true },
    });
    expect(resolver.resolve({ key: "dark", base: "dark" })).toBe(dark);

    const night = resolver.resolve({ key: "night", base: "dark" });
    expect(night).toEqual({
      color: "gold",
      width: 2,
      nested: { opacity: 0.8, visible: true },
    });
    expect(night).not.toBe(dark);

    const contrast = resolver.resolve({ key: "contrast", base: "dark" });
    expect(contrast).toEqual({
      color: "cyan",
      width: 3,
      nested: { opacity: 1, visible: true },
    });
  });
});
