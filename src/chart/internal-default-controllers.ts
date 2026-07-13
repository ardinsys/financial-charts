import type { ChartOptions, ControllerConstructor } from "./financial-chart";

const defaultControllerConstructorsKey = Symbol(
  "defaultControllerConstructors",
);

type ChartOptionsWithDefaultControllers = ChartOptions & {
  [defaultControllerConstructorsKey]?: readonly ControllerConstructor[];
};

export function withDefaultControllerConstructors(
  options: ChartOptions,
  controllers: readonly ControllerConstructor[],
): ChartOptions {
  const optionsWithDefaults: ChartOptionsWithDefaultControllers = {
    ...options,
    [defaultControllerConstructorsKey]: controllers,
  };
  return optionsWithDefaults;
}

export function getDefaultControllerConstructors(
  options: ChartOptions,
): readonly ControllerConstructor[] {
  return (
    (options as ChartOptionsWithDefaultControllers)[
      defaultControllerConstructorsKey
    ] ?? []
  );
}
