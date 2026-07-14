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

export interface IndicatorLabelSegment {
  text: string;
  color?: string;
}

/**
 * The declarative state of one indicator label. Indicators produce this rather
 * than authoring HTML, so DOM adapters can render it in app-native markup.
 */
export interface IndicatorLabelModel {
  /** Unique identity of this indicator instance. */
  instanceId: string;
  /** Stable factory/type identifier shared by instances of the same indicator. */
  typeId: string;
  /** Stable application-facing identifier for the label kind. */
  labelKey: string;
  themeKey: string;
  /** Localized display name. */
  name: string;
  /** Parameter / detail line, e.g. "10 close". */
  detail?: string;
  /** Current value(s); multiple segments render as colored parts (Bollinger, MACD, …). */
  segments: IndicatorLabelSegment[];
  visible: boolean;
  /** Which action controls to render. */
  actions: {
    canHide: boolean;
    canOpenSettings: boolean;
    canRemove: boolean;
  };
  actionTitles: IndicatorLabelActionTitles;
}

/**
 * A live handle to a mounted indicator label. `root` is the element the chart
 * mounts into the label region / pane; `update` re-renders from a new model.
 */
export interface IndicatorLabelHandle {
  readonly root: HTMLElement;
  update(model: IndicatorLabelModel): void;
  destroy(): void;
}

export interface PaneDividerModel {
  key: string;
  themeKey: string;
  beforePaneId: number;
  afterPaneId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaneDividerActions {
  onPointerDown(event: PointerEvent): void;
}

export interface PaneDividerHandle {
  readonly root: HTMLElement;
  update(model: PaneDividerModel): void;
  destroy(): void;
}

export interface ChartDOMOverlayContext {
  themeKey: string;
  /** Top offset (px) for the overlay label region. */
  labelTopOffset: number;
}

/**
 * The composition layer the adapter mounts on top of the canvas host: the
 * overlay indicator-label region, plus whatever surrounding DOM an adapter
 * chooses to render (toolbars, legend, settings panels). The core
 * only needs the label region back; everything else is the adapter's own.
 */
export interface ChartDOMOverlay {
  readonly indicatorLabelContainer: HTMLElement;
  update(context: ChartDOMOverlayContext): void;
  destroy(): void;
}

/**
 * Renders the DOM chrome that sits around the canvases. The default
 * {@link DefaultDOMAdapter} reproduces the built-in HTML behavior. The core
 * delegates non-canvas DOM to this adapter so applications can restyle or
 * replace it while staying in an HTMLElement-based environment. The default
 * implementation exposes stable `fci-*` classes and `data-id` hooks for CSS
 * restyling and integration tests.
 */
export interface ChartDOMAdapter {
  /**
   * Build the composition layer inside the chart's canvas host. Called once
   * during construction. `host` is the core-owned element that also hosts the
   * canvases; the adapter mounts its overlay into it and returns the region
   * the core appends indicator labels to.
   */
  createOverlay(
    host: HTMLElement,
    context: ChartDOMOverlayContext
  ): ChartDOMOverlay;
  createIndicatorLabel(
    model: IndicatorLabelModel,
    actions: IndicatorLabelActions
  ): IndicatorLabelHandle;
  /**
   * Render a draggable divider between panes. Omit this to reuse the default
   * divider while still replacing the rest of the adapter.
   */
  createPaneDivider?(
    model: PaneDividerModel,
    actions: PaneDividerActions
  ): PaneDividerHandle;
}
