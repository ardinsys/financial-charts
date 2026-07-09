import type { ChartContext, ChartPlugin } from "../plugin/chart-plugin";
import type { ChartData } from "../chart/types";
import type { ChartTheme } from "../chart/themes";
import type { Drawing, DrawingAnchor } from "../drawings/drawing";

export type DrawingAxisBoundKind = "single" | "start" | "end";

export interface DrawingAxisBoundsLabelContext {
  anchor: DrawingAnchor;
  chartData?: ChartData;
  drawing: Drawing;
  kind: DrawingAxisBoundKind;
}

export interface DrawingAxisBoundsValueContext extends DrawingAxisBoundsLabelContext {
  locale: string;
}

export interface DrawingAxisBoundsTextContext extends DrawingAxisBoundsValueContext {
  label: string;
  value: string;
}

export interface DrawingAxisBoundsLabels {
  start: string;
  end: string;
  single: string;
}

export type DrawingAxisBoundsLabelOptions =
  | Partial<DrawingAxisBoundsLabels>
  | Record<string, Partial<DrawingAxisBoundsLabels>>;

export interface DrawingAxisBoundsTheme {
  strokeColor: string;
  labelBackgroundColor: string;
  rangeBackgroundColor: string;
  textColor: string;
  fontSize: number;
  font: string;
  lineWidth: number;
  borderRadius: number;
  labelHeight: number;
  labelPaddingX: number;
}

export interface DrawingAxisBoundsPluginOptions {
  showXAxis?: boolean;
  showYAxis?: boolean;
  showRange?: boolean;
  blacklist?: readonly string[];
  labels?: DrawingAxisBoundsLabelOptions;
  theme?: Partial<DrawingAxisBoundsTheme>;
  formatXValue?: (context: DrawingAxisBoundsValueContext) => string;
  formatYValue?: (context: DrawingAxisBoundsValueContext) => string;
  formatText?: (context: DrawingAxisBoundsTextContext) => string;
}

interface AxisMark {
  anchor: DrawingAnchor;
  chartData?: ChartData;
  kind: DrawingAxisBoundKind;
  label: string;
}

interface PositionedAxisMark extends AxisMark {
  value: string;
  position: number;
}

const defaultOptions = {
  blacklist: ["text"] as const,
  showRange: true,
  showXAxis: true,
  showYAxis: true
} satisfies Required<
  Pick<
    DrawingAxisBoundsPluginOptions,
    "blacklist" | "showRange" | "showXAxis" | "showYAxis"
  >
>;

const defaultLabels: DrawingAxisBoundsLabels = {
  start: "S",
  end: "E",
  single: ""
};

const defaultTheme: DrawingAxisBoundsTheme = {
  strokeColor: "rgba(234, 179, 8, 0.9)",
  labelBackgroundColor: "#3A2E0F",
  rangeBackgroundColor: "rgba(234, 179, 8, 0.18)",
  textColor: "#FDE68A",
  fontSize: 11,
  font: "Roboto Mono",
  lineWidth: 1,
  borderRadius: 5,
  labelHeight: 22,
  labelPaddingX: 8
};

export class DrawingAxisBoundsPlugin implements ChartPlugin {
  readonly key = "drawing-axis-bounds";

  private ctx?: ChartContext;
  private selectedDrawing?: Drawing;
  private unsubscribers: Array<() => void> = [];

  constructor(private readonly options: DrawingAxisBoundsPluginOptions = {}) {}

  attach(ctx: ChartContext): void {
    this.ctx = ctx;
    this.unsubscribers = [
      ctx.onRenderStage("axes", () => this.drawAxisBounds()),
      ctx.on("drawing-select", (event) => {
        this.selectedDrawing = event.drawing;
        this.requestAxisRedraw();
      }),
      ctx.on("drawing-change", ({ drawing }) => {
        if (drawing === this.selectedDrawing) {
          this.requestAxisRedraw();
        }
      }),
      ctx.on("drawing-delete", ({ drawing }) => {
        if (drawing === this.selectedDrawing) {
          this.selectedDrawing = undefined;
          this.requestAxisRedraw();
        }
      })
    ];
  }

  detach(): void {
    for (const unsubscribe of this.unsubscribers.splice(0)) {
      unsubscribe();
    }
    this.selectedDrawing = undefined;
  }

  onVisibleRangeChanged(): void {
    this.requestAxisRedraw();
  }

  private drawAxisBounds() {
    const ctx = this.ctx;
    const drawing = this.selectedDrawing;
    if (!ctx || !drawing) return;
    if (this.isBlacklisted(drawing)) return;

    const pane = ctx
      .getPanes()
      .find((candidate) => candidate.getId() === drawing.getPaneId());
    const timeScale = pane?.getTimeScale();
    const priceScale = pane?.getPriceScale();
    if (!pane || !timeScale || !priceScale) return;

    const data = ctx.chart.getData();
    const locale = ctx.chart.getOptions().locale;
    const labels = this.resolveLabels(locale);
    const drawingCanvas = ctx.getCanvasContext("drawings").canvas;
    const axisBounds = drawing.getAxisBounds({
      pane,
      canvas: drawingCanvas
    });
    const theme = this.resolveTheme(ctx.chart.getTheme());

    if (this.options.showXAxis ?? defaultOptions.showXAxis) {
      const xAxis = ctx.getCanvasContext("x-label");
      const xAxisSize = ctx.getLogicalCanvas("x-label");
      const xMarks = this.createAxisMarks(
        axisBounds.x ?? [],
        "x",
        data,
        labels
      ).map((mark) => {
        const position = timeScale.projectIndex(mark.anchor.index, {
          canvas: drawingCanvas,
          barAlignment: pane.getTimeAnchorAlignment()
        });
        return {
          ...mark,
          position,
          value: this.formatXValue(mark, locale)
        };
      });

      this.drawXAxis(theme, xAxis, xAxisSize, xMarks);
    }

    if (this.options.showYAxis ?? defaultOptions.showYAxis) {
      const yAxis = ctx.getCanvasContext("y-label");
      const yAxisSize = ctx.getLogicalCanvas("y-label");
      const yMarks = this.createAxisMarks(
        axisBounds.y ?? [],
        "y",
        data,
        labels
      ).map((mark) => {
        const position = priceScale.project(mark.anchor.price, {
          canvas: drawingCanvas
        });
        return {
          ...mark,
          position,
          value: this.formatYValue(mark, locale)
        };
      });

      this.drawYAxis(theme, yAxis, yAxisSize, yMarks);
    }
  }

  private isBlacklisted(drawing: Drawing) {
    return (this.options.blacklist ?? defaultOptions.blacklist).includes(
      drawing.type
    );
  }

  private createAxisMarks(
    anchors: readonly DrawingAnchor[],
    axis: "x" | "y",
    data: readonly ChartData[],
    labels: DrawingAxisBoundsLabels
  ): AxisMark[] {
    const bounds = collapseAxisBounds(anchors, axis);

    if (bounds.length === 1) {
      const anchor = bounds[0];
      return [
        {
          anchor,
          chartData: data[Math.max(0, Math.round(anchor.index))],
          kind: "single",
          label: labels.single
        }
      ];
    }

    return bounds.map((anchor, index) => {
      const kind: DrawingAxisBoundKind = index === 0 ? "start" : "end";
      return {
        anchor,
        chartData: data[Math.max(0, Math.round(anchor.index))],
        kind,
        label: labels[kind]
      };
    });
  }

  private requestAxisRedraw() {
    this.ctx?.requestRedraw("axes");
  }

  private drawXAxis(
    theme: DrawingAxisBoundsTheme,
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number },
    marks: PositionedAxisMark[]
  ) {
    const plotWidth = Math.max(
      0,
      size.width - (this.ctx?.chart.getYLabelWidth() ?? 0)
    );
    if (this.options.showRange ?? defaultOptions.showRange) {
      this.drawXAxisRange(theme, ctx, size, plotWidth, marks);
    }

    for (const mark of marks) {
      this.drawXAxisBadge(theme, ctx, size, plotWidth, mark);
    }
  }

  private drawXAxisRange(
    theme: DrawingAxisBoundsTheme,
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number },
    plotWidth: number,
    marks: PositionedAxisMark[]
  ) {
    if (marks.length < 2) return;

    const [rawStart, rawEnd] = getRange(marks);
    const start = clamp(rawStart, 0, plotWidth);
    const end = clamp(rawEnd, 0, plotWidth);
    if (end <= start) return;

    const top = Math.max(3, size.height - theme.labelHeight - 4);

    ctx.save();
    ctx.fillStyle = theme.rangeBackgroundColor;
    ctx.fillRect(start, top, end - start, theme.labelHeight);
    ctx.strokeStyle = theme.strokeColor;
    ctx.lineWidth = theme.lineWidth;
    ctx.beginPath();
    ctx.moveTo(start, 0);
    ctx.lineTo(start, size.height);
    ctx.moveTo(end, 0);
    ctx.lineTo(end, size.height);
    ctx.stroke();
    ctx.restore();
  }

  private drawXAxisBadge(
    theme: DrawingAxisBoundsTheme,
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number },
    plotWidth: number,
    mark: PositionedAxisMark
  ) {
    const text = this.formatText(mark);

    ctx.save();
    ctx.font = getAxisBoundFont(theme);
    const width = Math.min(
      ctx.measureText(text).width + theme.labelPaddingX * 2,
      180
    );
    const left = clamp(mark.position - width / 2, 4, plotWidth - width - 4);
    const top = Math.max(3, size.height - theme.labelHeight - 4);

    ctx.strokeStyle = theme.strokeColor;
    ctx.fillStyle = theme.labelBackgroundColor;
    ctx.lineWidth = theme.lineWidth;
    roundedRect(ctx, left, top, width, theme.labelHeight, theme.borderRadius);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      text,
      left + width / 2,
      top + theme.labelHeight / 2,
      width - 8
    );
    ctx.restore();
  }

  private drawYAxis(
    theme: DrawingAxisBoundsTheme,
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number },
    marks: PositionedAxisMark[]
  ) {
    if (this.options.showRange ?? defaultOptions.showRange) {
      this.drawYAxisRange(theme, ctx, size, marks);
    }

    for (const mark of marks) {
      this.drawYAxisBadge(theme, ctx, size, mark);
    }
  }

  private drawYAxisRange(
    theme: DrawingAxisBoundsTheme,
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number },
    marks: PositionedAxisMark[]
  ) {
    if (marks.length < 2) return;

    const [rawStart, rawEnd] = getRange(marks);
    const start = clamp(rawStart, 0, size.height);
    const end = clamp(rawEnd, 0, size.height);
    if (end <= start) return;

    ctx.save();
    ctx.fillStyle = theme.rangeBackgroundColor;
    ctx.fillRect(5, start, size.width - 10, end - start);
    ctx.strokeStyle = theme.strokeColor;
    ctx.lineWidth = theme.lineWidth;
    ctx.beginPath();
    ctx.moveTo(0, start);
    ctx.lineTo(size.width, start);
    ctx.moveTo(0, end);
    ctx.lineTo(size.width, end);
    ctx.stroke();
    ctx.restore();
  }

  private drawYAxisBadge(
    theme: DrawingAxisBoundsTheme,
    ctx: CanvasRenderingContext2D,
    size: { width: number; height: number },
    mark: PositionedAxisMark
  ) {
    const text = this.formatText(mark);
    const top = clamp(
      mark.position - theme.labelHeight / 2,
      4,
      size.height - theme.labelHeight - 4
    );

    ctx.save();
    ctx.font = getAxisBoundFont(theme);
    ctx.strokeStyle = theme.strokeColor;
    ctx.fillStyle = theme.labelBackgroundColor;
    ctx.lineWidth = theme.lineWidth;
    roundedRect(
      ctx,
      5,
      top,
      size.width - 10,
      theme.labelHeight,
      theme.borderRadius
    );
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      text,
      size.width / 2,
      top + theme.labelHeight / 2,
      size.width - 14
    );
    ctx.restore();
  }

  private resolveLabels(locale: string): DrawingAxisBoundsLabels {
    return {
      ...defaultLabels,
      ...this.getLocalizedLabels(locale)
    };
  }

  private getLocalizedLabels(locale: string) {
    const labels = this.options.labels;
    if (!labels) return undefined;

    if (isLabelsObject(labels)) {
      return labels;
    }

    const language = locale.split("-")[0];
    return labels[locale] ?? labels[language] ?? labels["*"] ?? labels.default;
  }

  private resolveTheme(chartTheme: ChartTheme): DrawingAxisBoundsTheme {
    return {
      ...defaultTheme,
      ...chartTheme.drawingAxisBounds,
      ...this.options.theme
    };
  }

  private formatXValue(mark: AxisMark, locale: string): string {
    if (this.options.formatXValue) {
      return this.options.formatXValue({
        ...mark,
        drawing: this.selectedDrawing!,
        locale
      });
    }

    return mark.chartData?.time == undefined
      ? "-"
      : this.ctx!.chart.getFormatter().formatTooltipDate(mark.chartData.time);
  }

  private formatYValue(mark: AxisMark, locale: string): string {
    if (this.options.formatYValue) {
      return this.options.formatYValue({
        ...mark,
        drawing: this.selectedDrawing!,
        locale
      });
    }

    return this.ctx!.chart.getFormatter().formatPrice(mark.anchor.price);
  }

  private formatText(mark: PositionedAxisMark): string {
    const drawing = this.selectedDrawing!;
    const locale = this.ctx!.chart.getOptions().locale;
    if (this.options.formatText) {
      return this.options.formatText({
        ...mark,
        drawing,
        locale
      });
    }

    return mark.label ? `${mark.label} ${mark.value}` : mark.value;
  }
}

function getRange(marks: PositionedAxisMark[]) {
  const positions = marks.map((mark) => mark.position);
  return [Math.min(...positions), Math.max(...positions)] as const;
}

function collapseAxisBounds(
  anchors: readonly DrawingAnchor[],
  axis: "x" | "y"
): DrawingAnchor[] {
  const seen = new Set<string>();
  const unique: DrawingAnchor[] = [];

  for (const anchor of anchors) {
    const key =
      axis === "x" ? String(Math.round(anchor.index)) : anchor.price.toFixed(8);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...anchor, index: Math.round(anchor.index) });
  }

  if (unique.length <= 2) return unique;

  const sorted = [...unique].sort((a, b) =>
    axis === "x" ? a.index - b.index : a.price - b.price
  );
  return [sorted[0], sorted[sorted.length - 1]];
}

function getAxisBoundFont(theme: DrawingAxisBoundsTheme) {
  return `${theme.fontSize}px ${theme.font}, monospace`;
}

function isLabelsObject(
  labels: DrawingAxisBoundsLabelOptions
): labels is Partial<DrawingAxisBoundsLabels> {
  return "start" in labels || "end" in labels || "single" in labels;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const right = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(right - radius, y);
  ctx.quadraticCurveTo(right, y, right, y + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(x + radius, bottom);
  ctx.quadraticCurveTo(x, bottom, x, bottom - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(min, max), Math.max(min, value));
}
