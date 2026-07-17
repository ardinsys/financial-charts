import { DefaultDOMAdapter } from "../ui/default-dom-adapter";
import { DefaultFormatter } from "./formatter";
import { ownThemeRegistry, resolveChartTheme } from "./theme-registry";
import type { ChartThemeMap } from "./themes";
import {
  assertPositiveOption,
  assertTimeRangeOption,
  assertWheelZoomOption,
  cloneOptionValue,
  optionValuesEqual,
  timeRangeOptionsEqual,
  type ChartOptionKey,
  type ChartOptions,
  type ChartOptionsChangeEvent,
  type ChartOptionsSnapshot,
  type ChartOptionsUpdate,
  type ControllerConstructor,
  type ControllerType,
  type LocaleValuesMap,
  type MutableResolvedChartOptions,
} from "./chart-options";

/** Owns resolved runtime options and their stable readonly public snapshot. */
export class ChartOptionsState {
  private readonly themes: ChartThemeMap;
  private readonly resolved: MutableResolvedChartOptions;
  private snapshot: ChartOptionsSnapshot;

  constructor(
    options: ChartOptions,
    controllers: readonly ControllerConstructor[],
    includeDefaultControllers: boolean
  ) {
    const type =
      options.type ??
      (includeDefaultControllers &&
      controllers.some((controller) => controller.ID === "candle")
        ? "candle"
        : controllers[0]?.ID);
    if (!type) {
      throw new Error(
        "A chart type or at least one controller must be provided."
      );
    }

    const timeRange = options.timeRange ?? "auto";
    const maxZoom = options.maxZoom ?? 100;
    const wheelZoom = options.wheelZoom ?? "always";
    assertTimeRangeOption(timeRange);
    assertPositiveOption("stepSize", options.stepSize);
    assertPositiveOption("maxZoom", maxZoom);
    assertWheelZoomOption(wheelZoom);

    const locale =
      options.locale ||
      options.formatter?.getLocale() ||
      resolveRuntimeLocale();
    const timeZone = options.timeZone ?? options.formatter?.getTimeZone?.();
    const formatter =
      options.formatter || new DefaultFormatter({ locale, timeZone });
    formatter.setLocale(locale);
    formatter.setTimeZone?.(timeZone);

    this.themes = ownThemeRegistry(options.themes);

    this.resolved = {
      type,
      timeRange: timeRange === "auto" ? "auto" : { ...timeRange },
      stepSize: options.stepSize,
      maxZoom,
      wheelZoom,
      volume: options.volume ?? true,
      controllers: ownControllerSnapshot(controllers),
      includeDefaultControllers,
      locale,
      timeZone,
      formatter,
      theme: resolveChartTheme(options.theme ?? "light", this.themes),
      domAdapter: options.domAdapter ?? new DefaultDOMAdapter(),
      localeValues: cloneOptionValue({
        ...getDefaultLocaleValues(),
        ...options.localeValues,
      }),
    };
    this.snapshot = this.createSnapshot();
  }

  getResolved(): MutableResolvedChartOptions {
    return this.resolved;
  }

  getSnapshot(): ChartOptionsSnapshot {
    return this.snapshot;
  }

  setControllers(controllers: readonly ControllerConstructor[]): void {
    this.resolved.controllers = ownControllerSnapshot(controllers);
    this.snapshot = this.createSnapshot();
  }

  applyUpdate(
    update: ChartOptionsUpdate,
    assertControllerType: (type: ControllerType) => void
  ): ChartOptionsChangeEvent | undefined {
    const has = (key: ChartOptionKey) =>
      Object.prototype.hasOwnProperty.call(update, key);

    const type = update.type ?? this.resolved.type;
    const timeRange = update.timeRange ?? this.resolved.timeRange;
    const stepSize = update.stepSize ?? this.resolved.stepSize;
    const maxZoom = update.maxZoom ?? this.resolved.maxZoom;
    const wheelZoom = update.wheelZoom ?? this.resolved.wheelZoom;
    const volume = update.volume ?? this.resolved.volume;
    const formatter = update.formatter ?? this.resolved.formatter;
    const hasFormatter = update.formatter !== undefined;
    const locale =
      update.locale ??
      (hasFormatter ? formatter.getLocale() : this.resolved.locale);
    const timeZone = has("timeZone")
      ? update.timeZone
      : hasFormatter
        ? (formatter.getTimeZone?.() ?? this.resolved.timeZone)
        : this.resolved.timeZone;
    const themeKey = update.theme ?? this.resolved.theme.key;
    const theme =
      has("theme") && themeKey !== this.resolved.theme.key
        ? resolveChartTheme(themeKey, this.themes)
        : this.resolved.theme;
    const localeValues = has("localeValues")
      ? cloneOptionValue({
          ...getDefaultLocaleValues(),
          ...this.resolved.localeValues,
          ...(update.localeValues ?? {}),
        })
      : this.resolved.localeValues;

    assertTimeRangeOption(timeRange);
    assertPositiveOption("stepSize", stepSize);
    assertPositiveOption("maxZoom", maxZoom);
    assertWheelZoomOption(wheelZoom);
    if (type !== this.resolved.type) assertControllerType(type);

    const changes: Array<[ChartOptionKey, boolean]> = [
      ["type", type !== this.resolved.type],
      ["timeRange", !timeRangeOptionsEqual(timeRange, this.resolved.timeRange)],
      ["stepSize", stepSize !== this.resolved.stepSize],
      ["maxZoom", maxZoom !== this.resolved.maxZoom],
      ["wheelZoom", wheelZoom !== this.resolved.wheelZoom],
      ["volume", volume !== this.resolved.volume],
      ["theme", theme.key !== this.resolved.theme.key],
      ["locale", locale !== this.resolved.locale],
      ["timeZone", timeZone !== this.resolved.timeZone],
      ["formatter", formatter !== this.resolved.formatter],
      [
        "localeValues",
        !optionValuesEqual(localeValues, this.resolved.localeValues),
      ],
    ];
    const changedKeys = changes
      .filter(([, changed]) => changed)
      .map(([key]) => key);
    if (changedKeys.length === 0) return undefined;

    const previous = this.snapshot;
    const localizationChanged =
      changedKeys.includes("locale") ||
      changedKeys.includes("timeZone") ||
      changedKeys.includes("formatter") ||
      changedKeys.includes("localeValues");
    if (localizationChanged) {
      formatter.setLocale(locale);
      formatter.setTimeZone?.(timeZone);
    }

    this.resolved.type = type;
    this.resolved.timeRange = timeRange === "auto" ? "auto" : { ...timeRange };
    this.resolved.stepSize = stepSize;
    this.resolved.maxZoom = maxZoom;
    this.resolved.wheelZoom = wheelZoom;
    this.resolved.volume = volume;
    this.resolved.theme = theme;
    this.resolved.locale = locale;
    this.resolved.timeZone = timeZone;
    this.resolved.formatter = formatter;
    this.resolved.localeValues = localeValues;
    this.snapshot = this.createSnapshot();

    return {
      previous,
      current: this.snapshot,
      changedKeys,
    };
  }

  private createSnapshot(): ChartOptionsSnapshot {
    return {
      type: this.resolved.type,
      timeRange: this.resolved.timeRange,
      stepSize: this.resolved.stepSize,
      maxZoom: this.resolved.maxZoom,
      wheelZoom: this.resolved.wheelZoom,
      volume: this.resolved.volume,
      controllers: this.resolved.controllers,
      includeDefaultControllers: this.resolved.includeDefaultControllers,
      locale: this.resolved.locale,
      timeZone: this.resolved.timeZone,
      formatter: this.resolved.formatter,
      theme: this.resolved.theme,
      domAdapter: this.resolved.domAdapter,
      localeValues: this.resolved.localeValues,
    };
  }
}

function resolveRuntimeLocale(): string {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }
  return "en-US";
}

function getDefaultLocaleValues(): LocaleValuesMap {
  return {
    default: {
      indicators: {
        actions: {
          show: "Show",
          hide: "Hide",
          settings: "Settings",
          remove: "Remove",
        },
      },
      common: {
        sources: {
          open: "open",
          high: "high",
          low: "low",
          close: "close",
          volume: "volume",
        },
      },
    },
  };
}

function ownControllerSnapshot(
  controllers: readonly ControllerConstructor[]
): readonly ControllerConstructor[] {
  return [...controllers];
}
