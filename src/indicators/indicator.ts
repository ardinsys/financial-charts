import type { FinancialChart } from "../chart/financial-chart";
import { mergeThemes } from "../chart/themes";
import { TimeRange } from "../chart/types";
import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";
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
  protected labelContainer: HTMLElement;
  protected visible = true;
  private labelListenerDisposers: Array<() => void> = [];

  constructor(
    themes?: Record<string, Partial<TTheme>> | undefined | null,
    options?: Partial<TOptions> | undefined | null
  ) {
    this.themes = mergeThemes(this.getDefaultThemes(), themes);
    this.options = mergeThemes(this.getDefaultOptions(), options);
    this.labelContainer = document.createElement("div");
    this.labelContainer.style.position = "relative";
    this.labelContainer.style.zIndex = "101";
    this.labelContainer.style.width = "fit-content";
    this.labelContainer.classList.add("financial-indicator");
  }

  public get key() {
    return this.options.key;
  }

  public attach(ctx: ChartContext): void {
    this.chartContext = ctx;
    this.setChart(ctx.chart);
  }

  public setChart(chart: FinancialChart): void {
    this.detachLabelListeners();
    this.chart = chart;
    this.theme = this.themes[chart.getOptions().theme.key];
    this.labelContainer.innerHTML = this.renderLabel();

    const label = this.labelContainer.querySelector(
      '[data-id="label"]'
    ) as HTMLElement;
    const hide = this.labelContainer.querySelector(
      '[data-id="hide"]'
    ) as HTMLElement;
    const show = this.labelContainer.querySelector(
      '[data-id="show"]'
    ) as HTMLElement;
    const settings = this.labelContainer.querySelector(
      '[data-id="settings"]'
    ) as HTMLElement;
    const remove = this.labelContainer.querySelector(
      '[data-id="remove"]'
    ) as HTMLElement;

    hide.title = chart.getLocaleValues().indicators.actions.show;
    show.title = chart.getLocaleValues().indicators.actions.hide;
    settings.title = chart.getLocaleValues().indicators.actions.settings;
    remove.title = chart.getLocaleValues().indicators.actions.remove;

    this.addLabelClickListener(hide, () => {
      show.classList.remove("fci-hide");
      hide.classList.add("fci-hide");
      label.classList.remove("fci-hidden");
      this.visible = true;
      this.chart.requestRedraw(["controller", "crosshair", "indicators"]);
      this.chart.emit("indicator-visibility-changed", {
        indicator: this,
        visible: true
      });
    });

    this.addLabelClickListener(show, () => {
      hide.classList.remove("fci-hide");
      show.classList.add("fci-hide");
      label.classList.add("fci-hidden");
      this.visible = false;
      this.chart.requestRedraw(["controller", "crosshair", "indicators"]);
      this.chart.emit("indicator-visibility-changed", {
        indicator: this,
        visible: false
      });
    });

    this.addLabelClickListener(settings, () => {
      this.chart.emit("indicator-settings-open", {
        indicator: this
      });
    });

    this.addLabelClickListener(remove, () => {
      this.chart.removeIndicator(this);
      this.chart.emit("indicator-remove", {
        indicator: this
      });
    });
  }

  protected renderLabel() {
    return (this.options.labelRenderer ?? defaultIndicatorLabelRenderer).render(
      {
        themeKey: this.chart.getOptions().theme.key,
        template: this.options.labelTemplate
      }
    );
  }

  private addLabelClickListener(
    element: HTMLElement | null,
    listener: () => void
  ) {
    if (!element) return;

    element.addEventListener("click", listener);
    this.labelListenerDisposers.push(() => {
      element.removeEventListener("click", listener);
    });
  }

  private detachLabelListeners() {
    for (const dispose of this.labelListenerDisposers.splice(0)) {
      dispose();
    }
  }

  public detach(): void {
    this.detachLabelListeners();
  }

  public getModifier(_visibleTimeRange: TimeRange): ScaleRangeModifier | null {
    return null;
  }

  public updateLocale() {
    const hide = this.labelContainer.querySelector(
      '[data-id="hide"]'
    ) as HTMLElement;
    const show = this.labelContainer.querySelector(
      '[data-id="show"]'
    ) as HTMLElement;
    const settings = this.labelContainer.querySelector(
      '[data-id="settings"]'
    ) as HTMLElement;
    const remove = this.labelContainer.querySelector(
      '[data-id="remove"]'
    ) as HTMLElement;

    hide.title = this.chart.getLocaleValues().indicators.actions.show;
    show.title = this.chart.getLocaleValues().indicators.actions.hide;
    settings.title = this.chart.getLocaleValues().indicators.actions.settings;
    remove.title = this.chart.getLocaleValues().indicators.actions.remove;

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
