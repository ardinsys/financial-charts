import { FinancialChartBase } from "./financial-chart";
import type { ChartOptions } from "./chart-options";
import { defaultControllers } from "../controllers/default-controllers";
import { withDefaultControllerConstructors } from "./internal-default-controllers";

/** Financial chart configured with every built-in controller. */
export class FinancialChart extends FinancialChartBase {
  constructor(
    container: HTMLElement,
    options: ChartOptions,
  ) {
    super(
      container,
      withDefaultControllerConstructors(options, defaultControllers),
    );
  }
}
