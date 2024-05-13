import { mergeThemes } from "../chart/themes";
import { FinancialChart } from "../chart/financial-chart";
import { ExtentModifier } from "../extents/data-extent";
import { TimeRange } from "../chart/types";

export const indicatorLabelTemplate = {
  light: /* html */ `
      <div class="fci-wrapper">
      <div class="fci-label" data-id="label">
        <span class="fci-name" data-id="name"></span>
        <span class="fci-extra" data-id="extra"></span>
        <span class="fci-value" data-id="value"></span>
      </div>
      <div class="fci-actions">
        <button class="fci-btn" data-id="show">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 576 512"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>  
        </button>
        <button class="fci-btn fci-hide" data-id="hide">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 640 512"><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z"/></svg>
        </button>
        <button class="fci-btn" data-id="settings">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" fill="currentColor"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>
        </button>
        <button class="fci-btn" data-id="remove">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="16" height="16" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>  
        </button>
      </div>
    </div>
    `,
  dark: /* html */ `
    <div class="fci-wrapper">
      <div class="fci-label" data-id="label">
        <span class="fci-name" data-id="name"></span>
        <span class="fci-extra" data-id="extra"></span>
        <span class="fci-value" data-id="value"></span>
      </div>
      <div class="fci-actions">
        <button class="fci-btn" data-id="show">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 576 512"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3z"/></svg>  
        </button>
        <button class="fci-btn fci-hide" data-id="hide">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 640 512"><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L525.6 386.7c39.6-40.6 66.4-86.1 79.9-118.4c3.3-7.9 3.3-16.7 0-24.6c-14.9-35.7-46.2-87.7-93-131.1C465.5 68.8 400.8 32 320 32c-68.2 0-125 26.3-169.3 60.8L38.8 5.1zM223.1 149.5C248.6 126.2 282.7 112 320 112c79.5 0 144 64.5 144 144c0 24.9-6.3 48.3-17.4 68.7L408 294.5c8.4-19.3 10.6-41.4 4.8-63.3c-11.1-41.5-47.8-69.4-88.6-71.1c-5.8-.2-9.2 6.1-7.4 11.7c2.1 6.4 3.3 13.2 3.3 20.3c0 10.2-2.4 19.8-6.6 28.3l-90.3-70.8zM373 389.9c-16.4 6.5-34.3 10.1-53 10.1c-79.5 0-144-64.5-144-144c0-6.9 .5-13.6 1.4-20.2L83.1 161.5C60.3 191.2 44 220.8 34.5 243.7c-3.3 7.9-3.3 16.7 0 24.6c14.9 35.7 46.2 87.7 93 131.1C174.5 443.2 239.2 480 320 480c47.8 0 89.9-12.9 126.2-32.5L373 389.9z"/></svg>
        </button>
        <button class="fci-btn" data-id="settings">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" fill="currentColor"><path d="M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z"/></svg>
        </button>
        <button class="fci-btn" data-id="remove">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="16" height="16" fill="currentColor"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>  
        </button>
      </div>
    </div>
    `,
};

export interface DefaultIndicatorOptions {
  labelTemplate: Record<string, string>;
  names: Record<string, string>;
  key: string;
}

export abstract class Indicator<
  TTheme extends object,
  TOptions extends DefaultIndicatorOptions
> {
  protected themes!: Record<string, TTheme>;
  protected options!: TOptions;
  protected chart!: FinancialChart;
  protected theme!: TTheme;
  protected labelContainer: HTMLElement;
  protected visible = true;

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

  public setChart(chart: FinancialChart): void {
    this.chart = chart;
    this.theme = this.themes[chart.getOptions().theme.key];
    this.labelContainer.innerHTML =
      this.options.labelTemplate[this.chart.getOptions().theme.key];

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

    hide?.addEventListener("click", () => {
      show.classList.remove("fci-hide");
      hide.classList.add("fci-hide");
      label.classList.remove("fci-hidden");
      this.visible = true;
      this.chart.requestRedraw(["controller", "crosshair", "indicators"]);
      this.chart.emit("indicator-visibility-changed", {
        indicator: this,
        visible: true,
      });
    });

    show?.addEventListener("click", () => {
      hide.classList.remove("fci-hide");
      show.classList.add("fci-hide");
      label.classList.add("fci-hidden");
      this.visible = false;
      this.chart.requestRedraw(["controller", "crosshair", "indicators"]);
      this.chart.emit("indicator-visibility-changed", {
        indicator: this,
        visible: false,
      });
    });

    settings?.addEventListener("click", () => {
      this.chart.emit("indicator-settings-open", {
        indicator: this,
      });
    });

    remove?.addEventListener("click", () => {
      this.chart.removeIndicator(this);
      this.chart.emit("indicator-remove", {
        indicator: this,
      });
    });
  }

  public getModifier(visibleTimeRange: TimeRange): ExtentModifier | null {
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
    this.chart.requestRedraw(["indicators", "crosshair"]);
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
