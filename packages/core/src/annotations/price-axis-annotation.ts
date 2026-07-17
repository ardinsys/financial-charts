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
  /** Defaults to a plot line. */
  readonly line?: boolean | "plot" | "axis";
  readonly label?: boolean;
  readonly color?: string;
  readonly labelColor?: string;
  readonly textColor?: string;
  readonly emphasized?: boolean;
  readonly lineWidth?: number;
  readonly lineDash?: readonly number[];
  readonly collision?: "hide" | "allow";
  readonly range?: {
    readonly to: number;
    readonly color?: string;
    readonly inset?: number;
  };
  readonly labelStyle?: {
    readonly borderColor?: string;
    readonly borderWidth?: number;
    readonly edgeInset?: number;
    readonly font?: string;
    readonly fontSize?: number;
    readonly height?: number;
    readonly inset?: number;
    readonly paddingX?: number;
    readonly radius?: number;
  };
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
  formatter,
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
      devicePixelRatio: 1,
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
        annotation.labelColor ?? annotation.color ?? annotationTheme.labelColor,
      textColor: annotation.textColor ?? annotationTheme.textColor,
      lineWidth,
      lineDash: annotation.lineDash ?? annotationTheme.lineDash,
      text: annotation.text ?? formatter.formatPrice(annotation.value),
      order: annotationOrder,
    });
  }

  for (const item of resolved) {
    const range = item.annotation.range;
    if (!range) continue;

    const paneRegion = item.pane.getRegion();
    const axisRegion = item.pane.getYAxisRegion();
    const targetY = item.pane.getPriceScale().project(range.to, {
      canvas: { width: paneRegion.width, height: paneRegion.height },
      devicePixelRatio: 1,
    });
    if (!Number.isFinite(targetY)) continue;

    const start = Math.max(
      paneRegion.y,
      Math.min(item.y, paneRegion.y + paneRegion.height)
    );
    const end = Math.max(
      paneRegion.y,
      Math.min(paneRegion.y + targetY, paneRegion.y + paneRegion.height)
    );
    const top = Math.min(start, end);
    const rangeHeight = Math.abs(end - start);
    if (rangeHeight === 0) continue;

    const inset = Math.max(0, range.inset ?? 0);
    context.fillStyle = range.color ?? item.labelColor;
    context.fillRect(
      axisRegion.x + inset,
      top,
      Math.max(0, axisRegion.width - inset * 2),
      rangeHeight
    );
  }

  for (const item of resolved) {
    if (item.annotation.line === false) continue;
    const region =
      item.annotation.line === "axis"
        ? item.pane.getYAxisRegion()
        : item.pane.getRegion();
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
    const labelStyle = item.annotation.labelStyle;
    const labelHeight =
      labelStyle?.height ?? theme.priceAxisAnnotation.labelHeight;
    const edgeInset = Math.max(0, labelStyle?.edgeInset ?? 0);
    const paneRegion = item.pane.getRegion();
    const axisRegion = item.pane.getYAxisRegion();
    const centerY = Math.max(
      paneRegion.y + labelHeight / 2 + edgeInset,
      Math.min(
        item.y,
        paneRegion.y + paneRegion.height - labelHeight / 2 - edgeInset
      )
    );
    const bounds = {
      top: centerY - labelHeight / 2,
      bottom: centerY + labelHeight / 2,
    };
    const accepted = acceptedByPane.get(item.pane.getId()) ?? [];
    if (
      item.annotation.collision !== "allow" &&
      accepted.some(
        (existing) =>
          bounds.top < existing.bottom && bounds.bottom > existing.top
      )
    ) {
      continue;
    }
    if (item.annotation.collision !== "allow") {
      accepted.push(bounds);
      acceptedByPane.set(item.pane.getId(), accepted);
    }

    const inset = Math.max(0, labelStyle?.inset ?? 0);
    const left = axisRegion.x + inset;
    const width = Math.max(0, axisRegion.width - inset * 2);
    const radius = Math.max(0, labelStyle?.radius ?? 0);
    const borderWidth = Math.max(0, labelStyle?.borderWidth ?? 0);

    context.save();
    context.fillStyle = item.labelColor;
    if (radius > 0 || borderWidth > 0) {
      roundedRect(context, left, bounds.top, width, labelHeight, radius);
      context.fill();
      if (borderWidth > 0) {
        context.strokeStyle = labelStyle?.borderColor ?? item.color;
        context.lineWidth = borderWidth;
        context.stroke();
      }
    } else {
      context.fillRect(left, bounds.top, width, labelHeight);
    }
    context.fillStyle = item.textColor;
    const fontWeight = item.annotation.emphasized ? "600 " : "";
    const fontSize = labelStyle?.fontSize ?? theme.priceAxisAnnotation.fontSize;
    const font = labelStyle?.font ?? theme.priceAxisAnnotation.font;
    context.font = `${fontWeight}${fontSize}px ${font}, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      item.text,
      left + width / 2,
      centerY,
      Math.max(
        0,
        width -
          (labelStyle?.paddingX ?? theme.priceAxisAnnotation.labelPaddingX) * 2
      )
    );
    context.restore();
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
      annotation.range !== undefined &&
      !Number.isFinite(annotation.range.to)
    ) {
      throw new RangeError(
        "Price axis annotation range values must be finite."
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

    return {
      ...annotation,
      labelStyle: annotation.labelStyle
        ? { ...annotation.labelStyle }
        : undefined,
      range: annotation.range ? { ...annotation.range } : undefined,
      lineDash: annotation.lineDash ? [...annotation.lineDash] : undefined,
    };
  });

  return snapshot;
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  const right = x + width;
  const bottom = y + height;
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(right - safeRadius, y);
  context.quadraticCurveTo(right, y, right, y + safeRadius);
  context.lineTo(right, bottom - safeRadius);
  context.quadraticCurveTo(right, bottom, right - safeRadius, bottom);
  context.lineTo(x + safeRadius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}
