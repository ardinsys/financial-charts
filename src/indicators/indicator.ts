import type { FinancialChart } from "../chart/financial-chart";
import { mergeThemes } from "../chart/themes";
import { TimeRange } from "../chart/types";
import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";
import type { IndicatorLabelHandle } from "../ui/chart-ui-adapter";
import { ScaleRangeModifier } from "../scales/data-scale-model";
import {
  defaultIndicatorLabelRenderer,
  type IndicatorLabelRenderer,
  type IndicatorLabelTemplate
} from "./label-renderer";

export {
  defaultIndicatorLabelRenderer,
  indicatorLabelTemplate,
  TemplateIndicatorLabelRenderer
} from "./label-renderer";
export type { IndicatorLabelRenderer, IndicatorLabelTemplate };

export interface DefaultIndicatorOptions {
  labelTemplate?: IndicatorLabelTemplate;
  labelRenderer?: IndicatorLabelRenderer;
  names: Record<string, string>;
  key: string;
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
    this.setChart(ctx.chart);
  }

  public setChart(chart: FinancialChart): void {
    this.labelHandle?.destroy();
    this.chart = chart;
    this.theme = this.themes[chart.getOptions().theme.key];

    const actions = chart.getLocaleValues().indicators.actions;
    this.labelHandle = this.chartContext.ui.createIndicatorLabel(
      {
        key: this.options.key,
        themeKey: chart.getOptions().theme.key,
        templateHtml: this.renderLabel(),
        actionTitles: {
          show: actions.show,
          hide: actions.hide,
          settings: actions.settings,
          remove: actions.remove
        },
        visible: this.visible
      },
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

  protected renderLabel() {
    return (this.options.labelRenderer ?? defaultIndicatorLabelRenderer).render(
      {
        themeKey: this.chart.getOptions().theme.key,
        template: this.options.labelTemplate
      }
    );
  }

  public detach(): void {
    this.labelHandle?.destroy();
  }

  public getModifier(_visibleTimeRange: TimeRange): ScaleRangeModifier | null {
    return null;
  }

  public updateLocale() {
    const actions = this.chart.getLocaleValues().indicators.actions;
    this.labelHandle?.setActionTitles({
      show: actions.show,
      hide: actions.hide,
      settings: actions.settings,
      remove: actions.remove
    });

    this.updateLabel();
  }

  public abstract getDefaultOptions(): TOptions;
  public abstract getDefaultThemes(): Record<string, TTheme>;
  public abstract draw(): void;
  public abstract updateLabel(dataTime?: number): void;

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
