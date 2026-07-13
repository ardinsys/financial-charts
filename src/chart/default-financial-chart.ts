import {
  FinancialChart as CoreFinancialChart,
  type ChartOptions,
} from "./financial-chart";
import { defaultControllers } from "../controllers/default-controllers";
import type { TimeRange } from "./types";
import { withDefaultControllerConstructors } from "./internal-default-controllers";

/** Financial chart configured with every built-in controller. */
export class FinancialChart extends CoreFinancialChart {
  constructor(
    container: HTMLElement,
    timeRange: TimeRange | "auto",
    options: ChartOptions,
  ) {
    super(
      container,
      timeRange,
      withDefaultControllerConstructors(options, defaultControllers),
    );
  }
}
