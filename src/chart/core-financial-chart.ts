import {
  FinancialChart as FinancialChartBase,
  type ChartOptions,
  type ControllerConstructor,
} from "./financial-chart";
import type { TimeRange } from "./types";

export type CoreChartOptions = Omit<
  ChartOptions,
  "controllers" | "includeDefaultControllers"
> & {
  controllers: readonly ControllerConstructor[];
  includeDefaultControllers?: false;
};

/** Controller-neutral financial chart for minimal application bundles. */
export class FinancialChart extends FinancialChartBase {
  constructor(
    container: HTMLElement,
    timeRange: TimeRange | "auto",
    options: CoreChartOptions,
  ) {
    super(container, timeRange, options);
  }
}
