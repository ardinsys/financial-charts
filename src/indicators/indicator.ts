import type { FinancialChart } from "../chart/financial-chart";
import { mergeThemes } from "../chart/themes";
import { TimeRange } from "../chart/types";
import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";
import type {
  IndicatorLabelHandle,
  IndicatorLabelModel,
  IndicatorLabelSegment
} from "../ui/chart-ui-adapter";
import { ScaleRangeModifier } from "../scales/data-scale-model";

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

export abstract class Indicator<
  TTheme extends object,
  TOptions extends DefaultIndicatorOptions
> implements ChartPlugin
{
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
    this.setChart(ctx.chart);
  }

  public setChart(chart: FinancialChart): void {
    this.labelHandle?.destroy();
    this.chart = chart;
    this.theme = this.themes[chart.getOptions().theme.key];

    this.labelHandle = this.chartContext.ui.createIndicatorLabel(
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

  public updateLocale() {
    this.updateLabel();
  }

  /** Re-render the label. Rebuilds the model from `getLabelContent`. */
  public updateLabel(dataTime?: number): void {
    this.labelHandle?.update(this.buildLabelModel(dataTime));
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
    this.updateLabel();
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
