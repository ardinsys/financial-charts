import type { ControllerConstructor } from "../chart/chart-options";
import { AreaController } from "./area-controller";
import { BarController } from "./bar-controller";
import { CandlestickController } from "./candle-controller";
import { HLCAreaController } from "./hlc-area-controller";
import { HollowCandleController } from "./hollow-candle-controller";
import { LineController } from "./line-controller";
import { SteplineController } from "./step-line-controller";

export const defaultControllers: readonly ControllerConstructor[] =
  Object.freeze([
    AreaController,
    LineController,
    CandlestickController,
    BarController,
    HollowCandleController,
    SteplineController,
    HLCAreaController,
  ]);
