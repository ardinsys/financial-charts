import type {
  ChartOptionsChangeEvent,
  ChartOptionsSnapshot,
  LocaleValues
} from "../chart/chart-options";
import type { ChartData, TimeRange } from "../chart/types";
import { mergeObjects } from "../utils/merge";
import type {
  ChartExtension,
  ExtensionContext
} from "../plugin/chart-plugin";
import type {
  IndicatorLabelHandle,
  IndicatorLabelModel,
  IndicatorLabelSegment
} from "../ui/chart-dom-adapter";
import type { Formatter } from "../chart/formatter";
import type { ScaleRangeModifier } from "../scales/data-scale-model";
import type { BarAlignment } from "../scales/time-scale";
import {
  cloneJSONStateObject,
  isPlainRecord,
  type JSONStateObject,
  type JSONStateValue
} from "../utils/json-state";

const indicatorStateRedrawParts = [
  "grid",
  "axes",
  "series",
  "indicators",
  "crosshair"
] as const;

export type { IndicatorLabelSegment };

export interface DefaultIndicatorOptions {
  names: Record<string, string>;
  /** Stable label identifier used by adapters and application UI. */
  labelKey: string;
}

export interface IndicatorIdentityOptions {
  /** Restores the identity of a persisted or synchronized indicator. */
  instanceId?: string;
}

export type IndicatorOptionsInput<TOptions extends DefaultIndicatorOptions> =
  Partial<TOptions> & IndicatorIdentityOptions;

export type IndicatorStateValue = JSONStateValue;

export type IndicatorStateOptions = JSONStateObject;

export const INDICATOR_STATE_VERSION = 1 as const;

/** Versioned, JSON-safe state for one indicator instance. */
export interface IndicatorState {
  /** Indicator state schema version. */
  readonly version: typeof INDICATOR_STATE_VERSION;
  /** Factory identity returned by `getIndicatorType()`. */
  readonly typeId: string;
  /** Instance identity returned by `getInstanceId()`. */
  readonly instanceId: string;
  /** Indicator-specific configuration without label or runtime metadata. */
  readonly options: IndicatorStateOptions;
  readonly visible: boolean;
}

/** Creates a detached indicator for validated state supplied by the caller. */
export type IndicatorResolver<
  TIndicator extends Indicator<any, any> = Indicator<any, any>
> = (
  state: IndicatorState
) => TIndicator | undefined;

/** What a concrete indicator contributes to its label on each update. */
export interface IndicatorLabelContent {
  /** Override the display name (defaults to the localized `options.names`). */
  name?: string;
  /** Parameter / detail line, e.g. "10 close". */
  detail?: string;
  /** Value segment(s) shown at the current crosshair time. */
  segments?: IndicatorLabelSegment[];
}

export interface IndicatorPoint {
  readonly x: number;
  readonly y: number;
}

export interface IndicatorDrawingContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly canvas: HTMLCanvasElement;
  readonly data: readonly ChartData[];
  readonly visibleData: readonly ChartData[];
  readonly visibleTimeRange: TimeRange;
  readonly visible: boolean;
  readonly stepSize: number;
  readonly formatter: Formatter;
  readonly theme: ChartOptionsSnapshot["theme"];
  projectTime(time: number, barAlignment?: BarAlignment): number;
  projectPrice(value: number): number;
  projectPoint(
    time: number,
    value: number,
    barAlignment?: BarAlignment
  ): IndicatorPoint;
}

export interface IndicatorMutationOptions {
  emit?: boolean;
}

export interface IndicatorInvalidationOptions {
  /** Recalculate the visible price scale before redrawing. */
  scale?: boolean;
  /** Rebuild the adapter-rendered label. Defaults to `true`. */
  label?: boolean;
  /** Redraw the indicator layer. Defaults to `true`. */
  drawing?: boolean;
  /** Redraw crosshair content derived from the indicator. Defaults to `true`. */
  crosshair?: boolean;
}

export interface IndicatorContext extends Pick<
  ExtensionContext,
  | "domAdapter"
  | "signal"
  | "emit"
  | "getData"
  | "getOptions"
  | "getLogicalCanvas"
  | "getPanes"
  | "getVisibleTimeWindow"
  | "getVisibleTimeRange"
  | "on"
  | "onRenderStage"
  | "requestRedraw"
  | "setPriceAxisAnnotations"
  | "clearPriceAxisAnnotations"
> {
  getLocaleValues(): LocaleValues;
  getDrawingContext(visible: boolean): IndicatorDrawingContext;
  getLastXGridCoords(): readonly number[];
  invalidate(options?: IndicatorInvalidationOptions): void;
  remove(): void;
}

export abstract class Indicator<
  TTheme extends object,
  TOptions extends DefaultIndicatorOptions
> implements ChartExtension {
  protected themes!: Record<string, TTheme>;
  protected options!: TOptions;
  protected indicatorContext!: IndicatorContext;
  protected theme!: TTheme;
  protected labelContainer!: HTMLElement;
  protected visible = true;
  private labelHandle?: IndicatorLabelHandle;
  private attached = false;
  private readonly typeId: string;
  private instanceId: string;

  constructor(
    themes?: Record<string, Partial<TTheme>> | undefined | null,
    options?: IndicatorOptionsInput<TOptions> | undefined | null
  ) {
    const optionOverrides = { ...(options ?? {}) };
    const configuredInstanceId = optionOverrides.instanceId;
    delete optionOverrides.instanceId;

    this.themes = mergeObjects(this.getDefaultThemes(), themes);
    this.options = mergeObjects(
      this.getDefaultOptions(),
      optionOverrides as Partial<TOptions>
    );
    const Constructor = this.constructor as { ID?: string };
    this.typeId = validateTypeId(Constructor.ID);
    this.instanceId = validateInstanceId(
      configuredInstanceId ?? createInstanceId(this.typeId)
    );
  }

  public get key() {
    return this.instanceId;
  }

  public attach(ctx: IndicatorContext): void {
    this.indicatorContext = ctx;
    this.labelHandle?.destroy();
    this.theme = this.resolveTheme(ctx.getOptions().theme.key);
    this.attached = true;

    this.labelHandle = this.indicatorContext.domAdapter.createIndicatorLabel(
      this.buildLabelModel(),
      {
        onToggleVisibility: (visible) => {
          this.setVisible(visible);
        },
        onOpenSettings: () => {
          this.indicatorContext.emit("indicator-settings-open", {
            indicator: this
          });
        },
        onRemove: () => {
          this.indicatorContext.remove();
        }
      }
    );

    this.labelContainer = this.labelHandle.root;
  }

  private buildLabelModel(dataTime?: number): IndicatorLabelModel {
    const content = this.getLabelContent(dataTime);
    const options = this.indicatorContext.getOptions();
    const actions = this.indicatorContext.getLocaleValues().indicators.actions;
    return {
      instanceId: this.instanceId,
      typeId: this.getIndicatorType(),
      labelKey: this.getLabelKey(),
      themeKey: options.theme.key,
      name: content.name ?? this.resolveName(),
      detail: content.detail,
      segments: content.segments ?? [],
      visible: this.visible,
      actions: { canHide: true, canOpenSettings: true, canRemove: true },
      actionTitles: {
        show: actions.show,
        hide: actions.hide,
        settings: actions.settings,
        remove: actions.remove
      }
    };
  }

  private resolveName(): string {
    return (
      this.options.names[this.indicatorContext.getOptions().locale] ||
      this.options.names.default ||
      this.getLabelKey()
    );
  }

  private resolveTheme(themeKey: string): TTheme {
    return (
      this.themes[themeKey] ??
      this.themes.default ??
      this.themes.light ??
      Object.values(this.themes)[0] ??
      ({} as TTheme)
    );
  }

  public detach(): void {
    this.releaseAttachment();
  }

  /** @internal Ensures base cleanup even when a subclass overrides `detach()`. */
  public releaseAttachment(): void {
    this.labelHandle?.destroy();
    this.labelHandle = undefined;
    this.attached = false;
  }

  /** @internal Synchronizes base indicator state before user lifecycle hooks. */
  public applyChartOptions(event: ChartOptionsChangeEvent): void {
    if (!this.attached || !event.changedKeys.includes("theme")) return;
    this.theme = this.resolveTheme(event.current.theme.key);
    this.refreshLabel();
  }

  /** Invalidates external indicator state without depending on attachment state. */
  protected invalidate(options: IndicatorInvalidationOptions = {}): void {
    if (!this.attached) return;
    this.indicatorContext.invalidate(options);
  }

  public getModifier(_visibleTimeRange: TimeRange): ScaleRangeModifier | null {
    return null;
  }

  /** @internal Re-render the adapter label from `getLabelContent`. */
  public refreshLabel(dataTime?: number): void {
    this.labelHandle?.update(this.buildLabelModel(dataTime));
  }

  protected getDrawingContext(): IndicatorDrawingContext {
    return this.indicatorContext.getDrawingContext(this.visible);
  }

  public abstract getDefaultOptions(): TOptions;
  public abstract getDefaultThemes(): Record<string, TTheme>;
  public abstract draw(): void;

  /** Returns the configurable, JSON-safe option values stored in state. */
  protected serializeStateOptions(): Record<string, unknown> {
    const options = { ...this.options } as Record<string, unknown>;
    delete options.names;
    delete options.labelKey;
    return options;
  }

  /** Applies option values produced by `serializeStateOptions()`. */
  protected restoreStateOptions(options: IndicatorStateOptions): void {
    this.options = mergeObjects(this.options, options as Partial<TOptions>);
  }

  /**
   * Produce the label content for the given crosshair time (undefined = no
   * hover). The base fills name/actions/visibility; return detail + value
   * segments.
   */
  protected abstract getLabelContent(dataTime?: number): IndicatorLabelContent;

  public updateOptions(
    options: Partial<TOptions>,
    updateOptions: IndicatorMutationOptions = {}
  ): void {
    this.options = mergeObjects(this.options, options);
    if (!this.attached) return;
    this.indicatorContext.requestRedraw(indicatorStateRedrawParts);
    this.refreshLabel();
    if (updateOptions.emit ?? true) {
      this.indicatorContext.emit("indicator-change", { indicator: this });
    }
  }

  public setVisible(
    visible: boolean,
    updateOptions: IndicatorMutationOptions = {}
  ): void {
    if (this.visible === visible) return;

    this.visible = visible;
    if (!this.attached) return;

    this.indicatorContext.requestRedraw(indicatorStateRedrawParts);
    this.refreshLabel();
    if (updateOptions.emit ?? true) {
      this.indicatorContext.emit("indicator-visibility-changed", {
        indicator: this,
        visible
      });
    }
  }

  public isIndicatorVisible() {
    return this.visible;
  }

  public clone(): Indicator<TTheme, TOptions> {
    const Constructor = this.constructor as new (
      themes?: Record<string, Partial<TTheme>> | undefined | null,
      options?: IndicatorOptionsInput<TOptions> | undefined | null
    ) => Indicator<TTheme, TOptions>;
    const clonedOptions = cloneIndicatorValue(this.options);
    const clone = new Constructor(cloneIndicatorValue(this.themes), {
      ...clonedOptions,
      instanceId: createInstanceId(this.getIndicatorType())
    });
    clone.visible = this.visible;
    return clone;
  }

  public copyFrom(
    source: Indicator<TTheme, TOptions>,
    updateOptions: IndicatorMutationOptions = {}
  ): void {
    const wasVisible = this.visible;
    this.themes = cloneIndicatorValue(source.themes);
    this.options = cloneIndicatorValue(source.options);
    this.visible = source.visible;

    if (!this.attached) return;

    this.theme = this.resolveTheme(this.indicatorContext.getOptions().theme.key);
    this.indicatorContext.requestRedraw(indicatorStateRedrawParts);
    this.refreshLabel();

    if (updateOptions.emit ?? true) {
      this.indicatorContext.emit("indicator-change", { indicator: this });
      if (wasVisible !== this.visible) {
        this.indicatorContext.emit("indicator-visibility-changed", {
          indicator: this,
          visible: this.visible
        });
      }
    }
  }

  public getLabelContainer(): HTMLElement {
    return this.labelContainer;
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  /** Returns the stable application-facing identifier for this label kind. */
  public getLabelKey(): string {
    return this.options.labelKey;
  }

  /** Returns the stable factory/type identifier shared by same-type instances. */
  public getIndicatorType(): string {
    return this.typeId;
  }

  /** Returns a JSON-safe snapshot of this indicator's configurable state. */
  public toJSON(): IndicatorState {
    return {
      version: INDICATOR_STATE_VERSION,
      typeId: this.typeId,
      instanceId: this.instanceId,
      options: cloneJSONStateObject(
        this.serializeStateOptions(),
        "Indicator state options"
      ),
      visible: this.visible
    };
  }

  /** @internal Restores identity before attaching a synchronized clone. */
  public restoreInstanceId(instanceId: string): void {
    if (this.attached) {
      throw new Error("Cannot change the identity of an attached indicator.");
    }
    this.instanceId = validateInstanceId(instanceId);
  }

  /** @internal Applies validated state to a detached resolved indicator. */
  public restoreState(state: IndicatorState): void {
    if (this.attached) {
      throw new Error("Cannot restore the state of an attached indicator.");
    }
    if (state.typeId !== this.typeId) {
      throw new Error(
        `Cannot restore indicator type "${state.typeId}" into "${this.typeId}".`
      );
    }

    this.restoreStateOptions(state.options);
    this.instanceId = state.instanceId;
    this.visible = state.visible;
  }

  public getOptions() {
    return this.options;
  }
}

/** Restores validated state through an application-owned indicator resolver. */
export function restoreIndicator<TIndicator extends Indicator<any, any>>(
  state: unknown,
  resolver: IndicatorResolver<TIndicator>
): TIndicator {
  return restoreValidatedIndicator(validateIndicatorState(state), resolver);
}

/** @internal Restores an indicator state owned by a validated container. */
export function restoreValidatedIndicator<
  TIndicator extends Indicator<any, any>
>(
  state: IndicatorState,
  resolver: IndicatorResolver<TIndicator>
): TIndicator {
  const indicator = resolver(state);
  if (!indicator) {
    throw new Error(
      `No indicator resolver matched type "${state.typeId}".`
    );
  }
  if (indicator.getIndicatorType() !== state.typeId) {
    throw new Error(
      `Indicator resolver returned type "${indicator.getIndicatorType()}" for "${state.typeId}".`
    );
  }

  indicator.restoreState(state);
  return indicator;
}

let nextIndicatorInstanceId = 0;

function createInstanceId(typeId: string): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  if (randomId) return `${typeId}-${randomId}`;

  nextIndicatorInstanceId += 1;
  return `${typeId}-${nextIndicatorInstanceId}`;
}

function validateInstanceId(instanceId: string): string {
  if (typeof instanceId !== "string" || instanceId.trim().length === 0) {
    throw new Error("Indicator instanceId must not be empty.");
  }
  return instanceId;
}

function validateTypeId(typeId: unknown): string {
  if (typeof typeId !== "string" || typeId.trim().length === 0) {
    throw new Error("Indicator classes must define a non-empty static ID.");
  }
  return typeId;
}

/** @internal Validates and owns external indicator state. */
export function validateIndicatorState(state: unknown): IndicatorState {
  if (!isPlainRecord(state)) {
    throw new Error("Invalid indicator state: expected an object.");
  }
  if (!("version" in state) || typeof state.version !== "number") {
    throw new Error("Invalid indicator state: version must be a number.");
  }
  if (state.version !== INDICATOR_STATE_VERSION) {
    throw new Error(
      `Unsupported indicator state version "${state.version}"; expected ${INDICATOR_STATE_VERSION}.`
    );
  }
  if (typeof state.typeId !== "string" || state.typeId.trim().length === 0) {
    throw new Error("Invalid indicator state: typeId must not be empty.");
  }
  if (
    typeof state.instanceId !== "string" ||
    state.instanceId.trim().length === 0
  ) {
    throw new Error("Invalid indicator state: instanceId must not be empty.");
  }
  if (typeof state.visible !== "boolean") {
    throw new Error("Invalid indicator state: visible must be a boolean.");
  }
  if (!isPlainRecord(state.options)) {
    throw new Error("Invalid indicator state: options must be an object.");
  }
  if ("names" in state.options || "labelKey" in state.options) {
    throw new Error(
      "Invalid indicator state: options must not contain label metadata."
    );
  }

  return {
    version: INDICATOR_STATE_VERSION,
    typeId: state.typeId,
    instanceId: state.instanceId,
    options: cloneJSONStateObject(state.options, "Indicator state options"),
    visible: state.visible
  };
}

function cloneIndicatorValue<T extends object>(value: T): T {
  return mergeObjects(value);
}
