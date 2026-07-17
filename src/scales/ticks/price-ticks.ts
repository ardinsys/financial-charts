import type { AxisLabel } from "../../chart/types";

export interface PriceTickOptions {
  yMin: number;
  yMax: number;
  canvasHeight: number;
  fontSize: number;
  labelSpacing: number;
}

export function calculateStepSize(range: number, maxLabels: number): number {
  const rawStep = range / maxLabels;
  const scale = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalizedStep = rawStep / scale;

  let roundedStep: number;
  if (normalizedStep < 1.5) {
    roundedStep = 1;
  } else if (normalizedStep < 3) {
    roundedStep = 2;
  } else if (normalizedStep < 7.5) {
    roundedStep = 5;
  } else {
    roundedStep = 10;
  }

  return Number((roundedStep * scale).toPrecision(15));
}

export function calculateYAxisLabels({
  yMin,
  yMax,
  canvasHeight,
  fontSize,
  labelSpacing,
}: PriceTickOptions): AxisLabel[] {
  const textHeight = fontSize * 1.2;

  const rawRange = yMax - yMin;
  const referenceValue = Math.max(Math.abs(yMin), Math.abs(yMax));
  const range = Math.max(rawRange, referenceValue * 1e-4, 1e-12);

  const maxPossibleLabels = Math.max(
    1,
    Math.floor(canvasHeight / (textHeight + labelSpacing))
  );
  const stepSize = calculateStepSize(range, maxPossibleLabels);

  const firstLabel = Math.ceil(yMin / stepSize) * stepSize;
  const labels: AxisLabel[] = [];

  const labelCount = Math.max(
    0,
    Math.floor((yMax - firstLabel) / stepSize + 1e-12) + 1
  );
  for (let index = 0; index < labelCount; index++) {
    const value = firstLabel + index * stepSize;
    const position = canvasHeight - ((value - yMin) / range) * canvasHeight;
    labels.push({ value: Number(value.toPrecision(15)), position });
  }

  return labels;
}
