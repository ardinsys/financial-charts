import type { AxisLabel } from "../../chart/types";

export interface PriceTickOptions {
  yMin: number;
  yMax: number;
  canvasHeight: number;
  fontSize: number;
  labelSpacing: number;
}

export function calculateStepSize(range: number, maxLabels: number): number {
  // Step 1: Determine the initial raw step size
  const rawStep = range / maxLabels;

  // Step 2: Adjust for precision based on the range's magnitude
  const scale = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalizedStep = rawStep / scale; // Normalize step size to [1, 10)

  // Step 3: Round to a nice value
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

  // Calculate final step size
  const stepSize = roundedStep * scale;

  // Step 4: Adjust decimal places for the step size to ensure precision
  const decimalPlaces = Math.max(-Math.floor(Math.log10(stepSize)), 0);
  return parseFloat(stepSize.toFixed(decimalPlaces));
}

export function calculateYAxisLabels({
  yMin,
  yMax,
  canvasHeight,
  fontSize,
  labelSpacing,
}: PriceTickOptions): AxisLabel[] {
  const textHeight = fontSize * 1.2; // Estimated height of text

  let range = yMax - yMin;
  range = Math.max(range, 0.0001); // Ensure a minimum range to avoid division by zero

  const maxPossibleLabels = Math.floor(
    canvasHeight / (textHeight + labelSpacing)
  );
  const stepSize = calculateStepSize(range, maxPossibleLabels);

  const firstLabel = Math.ceil(yMin / stepSize) * stepSize;
  const labels: AxisLabel[] = [];

  for (let value = firstLabel; value <= yMax; value += stepSize) {
    const position = canvasHeight - ((value - yMin) / range) * canvasHeight;
    labels.push({ value: parseFloat(value.toFixed(10)), position });
  }

  return labels;
}
