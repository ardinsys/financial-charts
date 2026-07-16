import { describe, expect, it } from "vitest";
import type { ControllerConstructor } from "../src/chart/chart-options";
import { ControllerRegistry } from "../src/chart/controller-registry";
import { CandlestickController } from "../src/controllers/candle-controller";
import { LineController } from "../src/controllers/line-controller";

describe("ControllerRegistry", () => {
  it("reuses its snapshot until registration changes", () => {
    const registry = new ControllerRegistry([]);
    registry.register(LineController);
    const snapshot = registry.getSnapshot();

    expect(registry.getSnapshot()).toBe(snapshot);
    expect(registry.register(LineController)).toBe(false);
    expect(registry.getSnapshot()).toBe(snapshot);

    expect(registry.register(CandlestickController)).toBe(true);
    expect(registry.getSnapshot()).not.toBe(snapshot);
    expect(registry.getSnapshot()).toEqual([
      LineController,
      CandlestickController
    ]);
  });

  it("restores chart-class defaults without duplicating registrations", () => {
    const defaults: ControllerConstructor[] = [
      LineController,
      CandlestickController
    ];
    const registry = new ControllerRegistry(defaults);
    defaults.length = 0;

    expect(registry.registerDefaults()).toBe(true);
    const snapshot = registry.getSnapshot();
    expect(registry.registerDefaults()).toBe(false);
    expect(registry.getSnapshot()).toBe(snapshot);
    expect(registry.get("candle")).toBe(CandlestickController);
  });

  it("rejects invalid IDs and unknown controller types", () => {
    class InvalidController extends LineController {
      static ID = "default";
    }
    const registry = new ControllerRegistry([]);

    expect(() =>
      registry.register(InvalidController as ControllerConstructor)
    ).toThrow("Controller must have a static ID field!");
    expect(() => registry.get("missing")).toThrow(
      "Controller: missing is not registered!"
    );
  });
});
