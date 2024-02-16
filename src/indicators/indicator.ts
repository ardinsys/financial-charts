import { mergeThemes } from "../chart/themes";
import { FinancialChart } from "../chart/financial-chart";

export abstract class Indicator<
  TTheme extends object,
  TOptions extends object
> {
  static ID = "default";

  protected themes!: Record<string, TTheme>;
  protected options!: TOptions;
  protected chart!: FinancialChart;
  protected theme!: TTheme;

  constructor(
    themes?: Record<string, Partial<TTheme>> | undefined | null,
    options?: Partial<TOptions> | undefined | null
  ) {
    this.themes = mergeThemes(this.getDefaultThemes(), themes);
    this.options = mergeThemes(this.getDefaultOptions(), options);
  }

  public setChart(chart: FinancialChart): void {
    this.chart = chart;
    this.theme = this.themes[chart.getOptions().theme.key];
  }

  public abstract getDefaultOptions(): TOptions;
  public abstract getDefaultThemes(): Record<string, TTheme>;
  public abstract draw(): void;
}
