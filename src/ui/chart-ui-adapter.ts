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

/**
 * Renders the DOM chrome that sits around the canvases. The default
 * {@link WebUIAdapter} reproduces the built-in HTML behavior; framework
 * packages provide Vue/React implementations. The core never creates chrome
 * DOM directly — it delegates to the adapter.
 */
export interface ChartUIAdapter {
  createIndicatorLabel(
    descriptor: IndicatorLabelDescriptor,
    actions: IndicatorLabelActions
  ): IndicatorLabelHandle;
}
