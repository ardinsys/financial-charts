import type { FinancialChart } from "../chart/financial-chart";
import type { ChartData, TimeRange } from "../chart/types";
import { mergeThemes } from "../chart/themes";
import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";
import type {
  IndicatorLabelHandle,
  IndicatorLabelModel,
  IndicatorLabelSegment
} from "../ui/chart-dom-adapter";
import type { Formatter } from "../chart/formatter";
import type { DeepConcrete } from "../chart/financial-chart";
import type { ChartTheme } from "../chart/themes";
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
  theme: DeepConcrete<ChartTheme>;
  projectTime(time: number, barAlignment?: BarAlignment): number;
  projectPrice(value: number): number;
  projectPoint(
    time: number,
    value: number,
    barAlignment?: BarAlignment
  ): IndicatorPoint;
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
    this.theme = this.themes[ctx.chart.getOptions().theme.key];

    this.labelHandle = this.chartContext.domAdapter.createIndicatorLabel(
      this.buildLabelModel(),
      {
        onToggleVisibility: (visible) => {
          this.visible = visible;
          this.chart.requestRedraw(["controller", "crosshair", "indicators"]);
          this.chart.emit("indicator-visibility-changed", {
            indicator: this,
            visible
          });
        },
        onOpenSettings: () => {
          this.chart.emit("indicator-settings-open", { indicator: this });
        },
        onRemove: () => {
          this.chart.removeIndicator(this);
          this.chart.emit("indicator-remove", { indicator: this });
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

  public detach(): void {
    this.labelHandle?.destroy();
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

  public updateOptions(options: Partial<TOptions>): void {
    this.options = mergeThemes(this.options, options);
    if (!this.chart) return;
    this.chart.requestRedraw(["indicators", "crosshair", "controller"]);
    this.refreshLabel();
  }

  public getLabelContainer(): HTMLElement {
    return this.labelContainer;
  }

  public getKey() {
    return this.options.key;
  }

  public getOptions() {
    return this.options;
  }
}
