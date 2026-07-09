export interface IndicatorLabelActionTitles {
  show: string;
  hide: string;
  settings: string;
  remove: string;
}

/**
 * Callbacks the label view invokes on user interaction. The core owns the
 * behavior (redraw, events, removal); the adapter only wires the controls.
 */
export interface IndicatorLabelActions {
  onToggleVisibility(visible: boolean): void;
  onOpenSettings(): void;
  onRemove(): void;
}

export interface IndicatorLabelDescriptor {
  key: string;
  themeKey: string;
  /**
   * Resolved label markup produced by the indicator's `labelTemplate` /
   * `labelRenderer`. Indicators still author their own content and query it via
   * `data-id` hooks, so the markup contract is preserved across adapters.
   */
  templateHtml: string;
  actionTitles: IndicatorLabelActionTitles;
  visible: boolean;
}

/**
 * A live handle to a mounted indicator label. `root` is the element the
 * indicator writes its content into (its `labelContainer`); the chart mounts
 * `root` into a pane/label container exactly as before.
 */
export interface IndicatorLabelHandle {
  readonly root: HTMLElement;
  setActionTitles(titles: IndicatorLabelActionTitles): void;
  setVisible(visible: boolean): void;
  destroy(): void;
}

export interface ChartOverlayContext {
  themeKey: string;
  /** Top offset (px) for the overlay label region. */
  labelTopOffset: number;
}

/**
 * The composition layer the adapter mounts on top of the canvas host: the
 * overlay indicator-label region, plus whatever surrounding UI a framework
 * adapter chooses to render (toolbars, legend, settings panels). The core
 * only needs the label region back; everything else is the adapter's own.
 */
export interface ChartOverlay {
  readonly indicatorLabelContainer: HTMLElement;
  update(context: ChartOverlayContext): void;
  destroy(): void;
}

/**
 * Renders the DOM UI that sits around the canvases. The default
 * {@link WebUIAdapter} reproduces the built-in HTML behavior; framework
 * packages provide Vue/React implementations. The core never creates UI
 * DOM directly — it delegates to the adapter.
 */
export interface ChartUIAdapter {
  /**
   * Build the composition layer inside the chart's canvas host. Called once
   * during construction. `host` is the core-owned element that also hosts the
   * canvases; the adapter mounts its overlay into it and returns the region
   * the core appends indicator labels to.
   */
  createOverlay(host: HTMLElement, context: ChartOverlayContext): ChartOverlay;
  createIndicatorLabel(
    descriptor: IndicatorLabelDescriptor,
    actions: IndicatorLabelActions
  ): IndicatorLabelHandle;
}
