import type { Formatter } from "../chart/formatter";
import type { ResolvedChartTheme } from "../chart/themes";
import type { Pane } from "../panes/pane";

export type PriceAxisAnnotationOffscreenBehavior = "hide" | "clamp";

export interface PriceAxisAnnotation {
  /** Unique within the contributing extension. */
  readonly id: string;
  /** Target pane. Defaults to the main pane. */
  readonly paneId?: number;
  readonly value: number;
  /** Text shown in the axis label. Defaults to the formatted value. */
  readonly text?: string;
  readonly visible?: boolean;
  readonly line?: boolean;
  readonly label?: boolean;
  readonly color?: string;
  readonly labelColor?: string;
  readonly textColor?: string;
  readonly emphasized?: boolean;
  readonly lineWidth?: number;
  readonly lineDash?: readonly number[];
  /** Behavior when the value projects outside its pane. Defaults to `hide`. */
  readonly offscreen?: PriceAxisAnnotationOffscreenBehavior;
}

export interface PriceAxisAnnotationRenderOptions {
  readonly context: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  readonly panes: readonly Pane[];
  readonly annotations: Iterable<PriceAxisAnnotation>;
  readonly theme: ResolvedChartTheme;
  readonly formatter: Formatter;
}

interface ResolvedAnnotation {
  annotation: PriceAxisAnnotation;
  pane: Pane;
  y: number;
  color: string;
  labelColor: string;
  textColor: string;
  lineWidth: number;
  lineDash: readonly number[];
  text: string;
  order: number;
}

export function renderPriceAxisAnnotations({
  context,
  width,
  height,
  panes,
  annotations,
  theme,
  formatter
}: PriceAxisAnnotationRenderOptions): void {
  context.clearRect(0, 0, width, height);

  const paneById = new Map(panes.map((pane) => [pane.getId(), pane]));
  const mainPane = panes[0];
  if (!mainPane) return;

  const resolved: ResolvedAnnotation[] = [];
  let order = 0;
  for (const annotation of annotations) {
    const annotationOrder = order++;
    if (annotation.visible === false) continue;
    const pane =
      annotation.paneId === undefined
        ? mainPane
        : paneById.get(annotation.paneId);
    if (!pane) continue;

    const region = pane.getRegion();
    const relativeY = pane.getPriceScale().project(annotation.value, {
      canvas: { width: region.width, height: region.height },
      devicePixelRatio: 1
    });
    if (!Number.isFinite(relativeY)) continue;

    const outside = relativeY < 0 || relativeY > region.height;
    if (outside && annotation.offscreen !== "clamp") continue;

    const annotationTheme = theme.priceAxisAnnotation;
    const lineWidth =
      annotation.lineWidth ??
      (annotation.emphasized
        ? annotationTheme.emphasisLineWidth
        : annotationTheme.lineWidth);

    resolved.push({
      annotation,
      pane,
      y: region.y + Math.max(0, Math.min(relativeY, region.height)),
      color: annotation.color ?? annotationTheme.color,
      labelColor:
        annotation.labelColor ??
        annotation.color ??
        annotationTheme.labelColor,
      textColor: annotation.textColor ?? annotationTheme.textColor,
      lineWidth,
      lineDash: annotation.lineDash ?? annotationTheme.lineDash,
      text: annotation.text ?? formatter.formatPrice(annotation.value),
      order: annotationOrder
    });
  }

  for (const item of resolved) {
    if (item.annotation.line === false) continue;
    const region = item.pane.getRegion();
    const y = Math.max(
      region.y + item.lineWidth / 2,
      Math.min(item.y, region.y + region.height - item.lineWidth / 2)
    );

    context.save();
    context.beginPath();
    context.rect(region.x, region.y, region.width, region.height);
    context.clip();
    context.strokeStyle = item.color;
    context.lineWidth = item.lineWidth;
    context.setLineDash(item.lineDash as number[]);
    context.beginPath();
    context.moveTo(region.x, y);
    context.lineTo(region.x + region.width, y);
    context.stroke();
    context.restore();
  }

  const labelHeight = theme.priceAxisAnnotation.labelHeight;
  const acceptedByPane = new Map<
    number,
    Array<{ top: number; bottom: number }>
  >();
  const labels = resolved
    .filter((item) => item.annotation.label !== false && item.text.length > 0)
    .sort((a, b) => {
      const emphasis =
        Number(b.annotation.emphasized ?? false) -
        Number(a.annotation.emphasized ?? false);
      return emphasis || a.order - b.order;
    });

  for (const item of labels) {
    const paneRegion = item.pane.getRegion();
    const axisRegion = item.pane.getYAxisRegion();
    const centerY = Math.max(
      paneRegion.y + labelHeight / 2,
      Math.min(item.y, paneRegion.y + paneRegion.height - labelHeight / 2)
    );
    const bounds = {
      top: centerY - labelHeight / 2,
      bottom: centerY + labelHeight / 2
    };
    const accepted = acceptedByPane.get(item.pane.getId()) ?? [];
    if (
      accepted.some(
        (existing) =>
          bounds.top < existing.bottom && bounds.bottom > existing.top
      )
    ) {
      continue;
    }
    accepted.push(bounds);
    acceptedByPane.set(item.pane.getId(), accepted);

    context.fillStyle = item.labelColor;
    context.fillRect(axisRegion.x, bounds.top, axisRegion.width, labelHeight);
    context.fillStyle = item.textColor;
    context.font = `${item.annotation.emphasized ? "600 " : ""}${theme.priceAxisAnnotation.fontSize}px ${theme.priceAxisAnnotation.font}, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      item.text,
      axisRegion.x + axisRegion.width / 2,
      centerY,
      Math.max(
        0,
        axisRegion.width - theme.priceAxisAnnotation.labelPaddingX * 2
      )
    );
  }
}

export function snapshotPriceAxisAnnotations(
  annotations: readonly PriceAxisAnnotation[]
): readonly PriceAxisAnnotation[] {
  const ids = new Set<string>();
  const snapshot = annotations.map((annotation) => {
    if (annotation.id.trim().length === 0) {
      throw new TypeError("Price axis annotation ids cannot be empty.");
    }
    if (ids.has(annotation.id)) {
      throw new Error(
        `Duplicate price axis annotation id "${annotation.id}" from one extension.`
      );
    }
    ids.add(annotation.id);
    if (!Number.isFinite(annotation.value)) {
      throw new RangeError("Price axis annotation values must be finite.");
    }
    if (
      annotation.paneId !== undefined &&
      (!Number.isInteger(annotation.paneId) || annotation.paneId < 0)
    ) {
      throw new RangeError(
        "Price axis annotation pane ids must be non-negative integers."
      );
    }
    if (
      annotation.lineWidth !== undefined &&
      (!Number.isFinite(annotation.lineWidth) || annotation.lineWidth <= 0)
    ) {
      throw new RangeError(
        "Price axis annotation line widths must be finite and greater than zero."
      );
    }
    if (
      annotation.lineDash?.some((value) => !Number.isFinite(value) || value < 0)
    ) {
      throw new RangeError(
        "Price axis annotation line dash values must be finite and non-negative."
      );
    }

    return Object.freeze({
      ...annotation,
      lineDash: annotation.lineDash
        ? Object.freeze([...annotation.lineDash])
        : undefined
    });
  });

  return Object.freeze(snapshot);
}
