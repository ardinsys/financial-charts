import type {
  ChartOptionsChangeEvent,
  FinancialChart
} from "../chart/financial-chart";
import type { ChartData, TimeRange } from "../chart/types";
import { mergeThemes } from "../chart/themes";
import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";
import type {
  IndicatorLabelHandle,
  IndicatorLabelModel,
  IndicatorLabelSegment
} from "../ui/chart-dom-adapter";
import type { Formatter } from "../chart/formatter";
import type { ResolvedChartTheme } from "../chart/themes";
import type {
  DataScaleModel,
  ScaleRangeModifier
} from "../scales/data-scale-model";
import type { PriceScale } from "../scales/price-scale";
import type { ScaleProjectOptions } from "../scales/scale";
import type { BarAlignment, TimeScale } from "../scales/time-scale";

export type { IndicatorLabelSegment };

export interface DefaultIndicatorOptions {
  names: Record<string, string>;
  key: string;
}

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
  x: number;
  y: number;
}

export interface IndicatorDrawingContext {
  chart: FinancialChart;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  data: readonly ChartData[];
  visibleData: readonly ChartData[];
  visibleTimeRange: TimeRange;
  visible: boolean;
  stepSize: number;
  timeScale: TimeScale;
  priceScale: PriceScale;
  visibleScale: DataScaleModel;
  scaleOptions: ScaleProjectOptions & { barAlignment: BarAlignment };
  formatter: Formatter;
  theme: ResolvedChartTheme;
  projectTime(time: number, barAlignment?: BarAlignment): number;
  projectPrice(value: number): number;
  projectPoint(
    time: number,
    value: number,
    barAlignment?: BarAlignment
  ): IndicatorPoint;
}

export interface IndicatorUpdateOptions {
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

export abstract class Indicator<
  TTheme extends object,
  TOptions extends DefaultIndicatorOptions
> implements ChartPlugin {
  protected themes!: Record<string, TTheme>;
  protected options!: TOptions;
  protected chart!: FinancialChart;
  protected chartContext!: ChartContext;
  protected theme!: TTheme;
  protected labelContainer!: HTMLElement;
  protected visible = true;
  private labelHandle?: IndicatorLabelHandle;
  private attached = false;

  constructor(
    themes?: Record<string, Partial<TTheme>> | undefined | null,
    options?: Partial<TOptions> | undefined | null
  ) {
    this.themes = mergeThemes(this.getDefaultThemes(), themes);
    this.options = mergeThemes(this.getDefaultOptions(), options);
  }

  public get key() {
    return this.options.key;
  }

  public attach(ctx: ChartContext): void {
    this.chartContext = ctx;
    this.labelHandle?.destroy();
    this.chart = ctx.chart;
    this.theme = this.resolveTheme(ctx.chart.getOptions().theme.key);
    this.attached = true;

    this.labelHandle = this.chartContext.domAdapter.createIndicatorLabel(
      this.buildLabelModel(),
      {
        onToggleVisibility: (visible) => {
          this.setVisible(visible);
        },
        onOpenSettings: () => {
          this.chart.emit("indicator-settings-open", { indicator: this });
        },
        onRemove: () => {
          this.chart.removeIndicator(this);
        }
      }
    );

    this.labelContainer = this.labelHandle.root;
  }

  private buildLabelModel(dataTime?: number): IndicatorLabelModel {
    const content = this.getLabelContent(dataTime);
    const actions = this.chart.getLocaleValues().indicators.actions;
    return {
      key: this.options.key,
      themeKey: this.chart.getOptions().theme.key,
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
      this.options.names[this.chart.getOptions().locale] ||
      this.options.names.default ||
      this.options.key
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
    this.chart.invalidateIndicator(this, options);
  }

  public getModifier(_visibleTimeRange: TimeRange): ScaleRangeModifier | null {
    return null;
  }

  /** @internal Re-render the adapter label from `getLabelContent`. */
  public refreshLabel(dataTime?: number): void {
    this.labelHandle?.update(this.buildLabelModel(dataTime));
  }

  protected getDrawingContext(): IndicatorDrawingContext {
    const ctx = this.chart.getContext("indicator");
    const canvas = ctx.canvas;
    const timeScale = this.chart.getTimeScale();
    const priceScale = this.chart.getPriceScale();
    const timeAnchorAlignment = this.chart.getTimeAnchorAlignment();
    const scaleOptions = {
      canvas,
      barAlignment: timeAnchorAlignment
    };

    return {
      chart: this.chart,
      ctx,
      canvas,
      data: this.chart.getData(),
      visibleData: this.chart.getLastVisibleDataPoints(),
      visibleTimeRange: this.chart.getVisibleTimeRange(),
      visible: this.visible,
      stepSize: this.chart.getOptions().stepSize,
      timeScale,
      priceScale,
      visibleScale: this.chart.getVisibleScale(),
      scaleOptions,
      formatter: this.chart.getFormatter(),
      theme: this.chart.getTheme(),
      projectTime: (time, barAlignment = timeAnchorAlignment) =>
        timeScale.project(time, { canvas, barAlignment }),
      projectPrice: (value) => priceScale.project(value, scaleOptions),
      projectPoint: (time, value, barAlignment = timeAnchorAlignment) => ({
        x: timeScale.project(time, { canvas, barAlignment }),
        y: priceScale.project(value, scaleOptions)
      })
    };
  }

  public abstract getDefaultOptions(): TOptions;
  public abstract getDefaultThemes(): Record<string, TTheme>;
  public abstract draw(): void;

  /**
   * Produce the label content for the given crosshair time (undefined = no
   * hover). The base fills name/actions/visibility; return detail + value
   * segments.
   */
  protected abstract getLabelContent(dataTime?: number): IndicatorLabelContent;

  public updateOptions(
    options: Partial<TOptions>,
    updateOptions: IndicatorUpdateOptions = {}
  ): void {
    this.options = mergeThemes(this.options, options);
    if (!this.attached) return;
    this.chart.requestRedraw(["indicators", "crosshair", "controller"]);
    this.refreshLabel();
    if (updateOptions.emit ?? true) {
      this.chart.emit("indicator-change", { indicator: this });
    }
  }

  public setVisible(
    visible: boolean,
    updateOptions: IndicatorUpdateOptions = {}
  ): void {
    if (this.visible === visible) return;

    this.visible = visible;
    if (!this.attached) return;

    this.chart.requestRedraw(["controller", "crosshair", "indicators"]);
    this.refreshLabel();
    if (updateOptions.emit ?? true) {
      this.chart.emit("indicator-visibility-changed", {
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
      options?: Partial<TOptions> | undefined | null
    ) => Indicator<TTheme, TOptions>;
    const clone = new Constructor(
      cloneIndicatorValue(this.themes),
      cloneIndicatorValue(this.options)
    );
    clone.visible = this.visible;
    return clone;
  }

  public copyFrom(
    source: Indicator<TTheme, TOptions>,
    updateOptions: IndicatorUpdateOptions = {}
  ): void {
    const wasVisible = this.visible;
    this.themes = cloneIndicatorValue(source.themes);
    this.options = cloneIndicatorValue(source.options);
    this.visible = source.visible;

    if (!this.attached) return;

    this.theme = this.resolveTheme(this.chart.getOptions().theme.key);
    this.chart.requestRedraw(["indicators", "crosshair", "controller"]);
    this.refreshLabel();

    if (updateOptions.emit ?? true) {
      this.chart.emit("indicator-change", { indicator: this });
      if (wasVisible !== this.visible) {
        this.chart.emit("indicator-visibility-changed", {
          indicator: this,
          visible: this.visible
        });
      }
    }
  }

  public getLabelContainer(): HTMLElement {
    return this.labelContainer;
  }

  public getKey() {
    return this.options.key;
  }

  public getIndicatorType() {
    return (this.constructor as { ID?: string }).ID ?? this.options.key;
  }

  public getOptions() {
    return this.options;
  }
}

function cloneIndicatorValue<T>(value: T): T {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to the JSON clone for simple serializable configs.
    }
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
