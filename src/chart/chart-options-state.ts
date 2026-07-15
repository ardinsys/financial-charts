import { DefaultDOMAdapter } from "../ui/default-dom-adapter";
import { DefaultFormatter } from "./formatter";
import { defaultLightTheme, mergeThemes } from "./themes";
import {
  assertPositiveOption,
  assertTimeRangeOption,
  optionValuesEqual,
  snapshotOptionValue,
  timeRangeOptionsEqual,
  type ChartOptionKey,
  type ChartOptions,
  type ChartOptionsChangeEvent,
  type ChartOptionsSnapshot,
  type ChartOptionsUpdate,
  type ControllerConstructor,
  type ControllerType,
  type LocaleValuesMap,
  type MutableResolvedChartOptions
} from "./chart-options";

/** Owns resolved runtime options and their immutable public snapshot. */
export class ChartOptionsState {
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
    assertTimeRangeOption(timeRange);
    assertPositiveOption("stepSize", options.stepSize);
    assertPositiveOption("maxZoom", maxZoom);

    const locale =
      options.locale ||
      options.formatter?.getLocale() ||
      resolveRuntimeLocale();
    const timeZone = options.timeZone ?? options.formatter?.getTimeZone?.();
    const formatter =
      options.formatter || new DefaultFormatter({ locale, timeZone });
    formatter.setLocale(locale);
    formatter.setTimeZone?.(timeZone);

    this.resolved = {
      type,
      timeRange:
        timeRange === "auto" ? "auto" : Object.freeze({ ...timeRange }),
      stepSize: options.stepSize,
      maxZoom,
      volume: options.volume ?? true,
      controllers: Object.freeze([...controllers]),
      includeDefaultControllers,
      locale,
      timeZone,
      formatter,
      theme: snapshotOptionValue(
        mergeThemes(defaultLightTheme, options.theme)
      ),
      domAdapter: options.domAdapter ?? new DefaultDOMAdapter(),
      localeValues: snapshotOptionValue({
        ...getDefaultLocaleValues(),
        ...options.localeValues
      })
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
    this.resolved.controllers = Object.freeze([...controllers]);
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
    const volume = update.volume ?? this.resolved.volume;
    const formatter = update.formatter ?? this.resolved.formatter;
    const hasFormatter = update.formatter !== undefined;
    const locale =
      update.locale ??
      (hasFormatter ? formatter.getLocale() : this.resolved.locale);
    const timeZone = has("timeZone")
      ? update.timeZone
      : hasFormatter
        ? formatter.getTimeZone?.() ?? this.resolved.timeZone
        : this.resolved.timeZone;
    const theme = has("theme")
      ? snapshotOptionValue(mergeThemes(this.resolved.theme, update.theme))
      : this.resolved.theme;
    const localeValues = has("localeValues")
      ? snapshotOptionValue({
          ...getDefaultLocaleValues(),
          ...this.resolved.localeValues,
          ...(update.localeValues ?? {})
        })
      : this.resolved.localeValues;

    assertTimeRangeOption(timeRange);
    assertPositiveOption("stepSize", stepSize);
    assertPositiveOption("maxZoom", maxZoom);
    if (type !== this.resolved.type) assertControllerType(type);

    const changes: Array<[ChartOptionKey, boolean]> = [
      ["type", type !== this.resolved.type],
      [
        "timeRange",
        !timeRangeOptionsEqual(timeRange, this.resolved.timeRange)
      ],
      ["stepSize", stepSize !== this.resolved.stepSize],
      ["maxZoom", maxZoom !== this.resolved.maxZoom],
      ["volume", volume !== this.resolved.volume],
      ["theme", !optionValuesEqual(theme, this.resolved.theme)],
      ["locale", locale !== this.resolved.locale],
      ["timeZone", timeZone !== this.resolved.timeZone],
      ["formatter", formatter !== this.resolved.formatter],
      [
        "localeValues",
        !optionValuesEqual(localeValues, this.resolved.localeValues)
      ]
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
    this.resolved.timeRange =
      timeRange === "auto" ? "auto" : Object.freeze({ ...timeRange });
    this.resolved.stepSize = stepSize;
    this.resolved.maxZoom = maxZoom;
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
      changedKeys: Object.freeze(changedKeys)
    };
  }

  private createSnapshot(): ChartOptionsSnapshot {
    return Object.freeze({
      type: this.resolved.type,
      timeRange: this.resolved.timeRange,
      stepSize: this.resolved.stepSize,
      maxZoom: this.resolved.maxZoom,
      volume: this.resolved.volume,
      controllers: this.resolved.controllers,
      includeDefaultControllers: this.resolved.includeDefaultControllers,
      locale: this.resolved.locale,
      timeZone: this.resolved.timeZone,
      formatter: this.resolved.formatter,
      theme: this.resolved.theme,
      domAdapter: this.resolved.domAdapter,
      localeValues: this.resolved.localeValues
    });
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
          remove: "Remove"
        }
      },
      common: {
        sources: {
          open: "open",
          high: "high",
          low: "low",
          close: "close",
          volume: "volume"
        }
      }
    }
  };
}
