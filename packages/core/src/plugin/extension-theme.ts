import type { BuiltInChartThemeKey, ResolvedChartTheme } from "../chart/themes";
import { mergeObjects } from "../utils/merge";

export type ExtensionThemeDefaults<TTheme extends object> = Readonly<
  Record<string, TTheme> & Record<BuiltInChartThemeKey, TTheme>
>;

export type ExtensionThemeDefinition<TTheme> = TTheme extends Function
  ? TTheme
  : TTheme extends readonly unknown[]
    ? TTheme
    : TTheme extends object
      ? { [P in keyof TTheme]?: ExtensionThemeDefinition<TTheme[P]> }
      : TTheme;

export type ExtensionThemeMap<TTheme extends object> = Readonly<
  Record<string, ExtensionThemeDefinition<TTheme>>
>;

/** Resolves and caches extension-owned themes against the active chart theme. */
export class ExtensionThemeResolver<TTheme extends object> {
  private readonly defaults: ExtensionThemeDefaults<TTheme>;
  private readonly themes: ExtensionThemeMap<TTheme>;
  private resolved?: {
    key: string;
    base: BuiltInChartThemeKey;
    theme: TTheme;
  };

  constructor(
    defaults: ExtensionThemeDefaults<TTheme>,
    themes?: ExtensionThemeMap<TTheme>
  ) {
    this.defaults = ownDefaultThemeMap(defaults);
    this.themes = ownThemeMap(themes);
  }

  resolve(chartTheme: Pick<ResolvedChartTheme, "key" | "base">): TTheme {
    if (
      this.resolved?.key === chartTheme.key &&
      this.resolved.base === chartTheme.base
    ) {
      return this.resolved.theme;
    }

    const baseTheme = mergeObjects(
      this.defaults[chartTheme.base],
      this.themes[chartTheme.base]
    );
    const keyedDefault = this.defaults[chartTheme.key];
    let theme = baseTheme;
    if (chartTheme.key !== chartTheme.base) {
      if (keyedDefault) theme = mergeObjects(theme, keyedDefault);
      theme = mergeObjects(theme, this.themes[chartTheme.key]);
    }
    this.resolved = {
      key: chartTheme.key,
      base: chartTheme.base,
      theme,
    };
    return theme;
  }

  getThemes(): ExtensionThemeMap<TTheme> {
    return this.themes;
  }
}

function ownDefaultThemeMap<TTheme extends object>(
  defaults: ExtensionThemeDefaults<TTheme>
): ExtensionThemeDefaults<TTheme> {
  const owned: Record<string, TTheme> = {};
  for (const [key, theme] of Object.entries(defaults)) {
    owned[key] = mergeObjects(theme);
  }
  return owned as ExtensionThemeDefaults<TTheme>;
}

function ownThemeMap<TTheme extends object>(
  themes?: ExtensionThemeMap<TTheme>
): ExtensionThemeMap<TTheme> {
  if (!themes) return {};

  const owned: Record<string, ExtensionThemeDefinition<TTheme>> = {};
  for (const [key, theme] of Object.entries(themes)) {
    owned[key] = mergeObjects(theme);
  }
  return owned;
}
