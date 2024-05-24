import { FinancialChart } from "../chart/financial-chart";

export function randomColor(chart: FinancialChart, count: number): string {
  const randomColors = chart.getOptions().theme.randomColors;
  return randomColors[count % randomColors.length];
}
