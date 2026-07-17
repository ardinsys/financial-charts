import { FinancialChartBase } from "./financial-chart";
import type { ChartOptions, ControllerConstructor } from "./chart-options";

export type CoreChartOptions = Omit<
  ChartOptions,
  "controllers" | "includeDefaultControllers"
> & {
  controllers: readonly ControllerConstructor[];
  includeDefaultControllers?: false;
};

/** Controller-neutral financial chart for minimal application bundles. */
export class FinancialChart extends FinancialChartBase {
  constructor(container: HTMLElement, options: CoreChartOptions) {
    super(container, options);
  }
}
