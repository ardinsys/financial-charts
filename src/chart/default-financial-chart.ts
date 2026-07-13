import {
  FinancialChart as CoreFinancialChart,
  type ChartOptions,
} from "./financial-chart";
import { defaultControllers } from "../controllers/default-controllers";
import { withDefaultControllerConstructors } from "./internal-default-controllers";

/** Financial chart configured with every built-in controller. */
export class FinancialChart extends CoreFinancialChart {
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
