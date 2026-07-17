import { describe, expect, it } from "vitest";
import {
  type DefaultIndicatorOptions,
  Indicator,
  type IndicatorLabelContent,
  type IndicatorOptionsInput,
  type IndicatorStateOptions,
  restoreIndicator,
} from "../src/indicators/indicator";
import { TestIndicator } from "./fixtures/test-indicator";
import { MovingAverageIndicator } from "../src/indicators/simple/moving-average";
import type { ExtensionThemeDefaults } from "../src/plugin/extension-theme";

interface RuntimeIndicatorOptions extends DefaultIndicatorOptions {
  symbol: string;
  transform(value: number): number;
}

interface PriceService {
  readonly name: string;
}

class RuntimeIndicator extends Indicator<{}, RuntimeIndicatorOptions> {
  static readonly ID: string = "runtime-indicator";

  constructor(
    private readonly service: PriceService,
    options?: IndicatorOptionsInput<RuntimeIndicatorOptions>
  ) {
    super(null, options);
  }

  getDefaultOptions(): RuntimeIndicatorOptions {
    return {
      labelKey: "runtime",
      names: { default: "Runtime indicator" },
      symbol: "AAPL",
      transform: (value) => value * 2,
    };
  }

  getDefaultThemes(): ExtensionThemeDefaults<{}> {
    return { light: {}, dark: {} };
  }

  draw(): void {}

  getService(): PriceService {
    return this.service;
  }

  protected getLabelContent(): IndicatorLabelContent {
    return {};
  }

  protected serializeStateOptions(): Record<string, unknown> {
    return { symbol: this.options.symbol };
  }

  protected restoreStateOptions(options: IndicatorStateOptions): void {
    if (typeof options.symbol !== "string") {
      throw new Error("Runtime indicator state requires a symbol.");
    }
    this.options = { ...this.options, symbol: options.symbol };
  }
}

class UnsafeRuntimeIndicator extends RuntimeIndicator {
  static readonly ID = "unsafe-runtime-indicator";

  protected serializeStateOptions(): Record<string, unknown> {
    return { transform: this.getOptions().transform };
  }
}

describe("indicator state", () => {
  it("round-trips multiple same-type indicators with identity and visibility", () => {
    const fast = new MovingAverageIndicator(null, {
      instanceId: "fast-sma",
      period: 9,
      source: "close",
    });
    const slow = new MovingAverageIndicator(null, {
      instanceId: "slow-sma",
      period: 21,
      source: "open",
    });
    slow.setVisible(false);

    const serialized = JSON.stringify([fast.toJSON(), slow.toJSON()]);
    const states = JSON.parse(serialized) as unknown[];
    const restored = states.map((state) =>
      restoreIndicator(state, ({ typeId }) =>
        typeId === MovingAverageIndicator.ID
          ? new MovingAverageIndicator()
          : undefined
      )
    );

    expect(restored.map((indicator) => indicator.getInstanceId())).toEqual([
      "fast-sma",
      "slow-sma",
    ]);
    expect(restored.map((indicator) => indicator.getOptions().period)).toEqual([
      9, 21,
    ]);
    expect(restored.map((indicator) => indicator.getOptions().source)).toEqual([
      "close",
      "open",
    ]);
    expect(restored.map((indicator) => indicator.isIndicatorVisible())).toEqual(
      [true, false]
    );
  });

  it("omits label metadata and restores through injected runtime dependencies", () => {
    const originalService = { name: "original" };
    const restoredService = { name: "restored" };
    const indicator = new RuntimeIndicator(originalService, {
      instanceId: "runtime-1",
      symbol: "MSFT",
      transform: (value) => value + 1,
    });

    const state = indicator.toJSON();
    const serialized = JSON.stringify(state);
    const restored = restoreIndicator(JSON.parse(serialized), ({ typeId }) =>
      typeId === RuntimeIndicator.ID
        ? new RuntimeIndicator(restoredService)
        : undefined
    );
    const copied = new RuntimeIndicator(restoredService);
    copied.copyFrom(indicator);

    expect(state.options).toEqual({ symbol: "MSFT" });
    expect(serialized).not.toContain("Runtime indicator");
    expect(serialized).not.toContain("transform");
    expect(serialized).not.toContain("original");
    expect(restored.getService()).toBe(restoredService);
    expect(restored.getInstanceId()).toBe("runtime-1");
    expect(restored.getOptions().symbol).toBe("MSFT");
    expect(restored.getOptions().transform(2)).toBe(4);
    expect(copied.getService()).toBe(restoredService);
    expect(copied.getOptions().transform(2)).toBe(3);
  });

  it("rejects non-JSON option values instead of dropping them", () => {
    const indicator = new UnsafeRuntimeIndicator({ name: "runtime" });

    expect(() => indicator.toJSON()).toThrow(
      "Indicator state options.transform is not JSON-safe."
    );
  });

  it("serializes state independently from subsequent mutations", () => {
    const indicator = new MovingAverageIndicator(null, {
      instanceId: "independent-sma",
      period: 9,
    });
    const state = indicator.toJSON();

    indicator.updateOptions({ period: 12 });
    expect(state.options.period).toBe(9);

    (state.options as { period: number }).period = 30;
    expect(indicator.getOptions().period).toBe(12);
  });

  it("rejects malformed, unsupported, unknown, and mismatched state", () => {
    const state = new MovingAverageIndicator(null, {
      instanceId: "validated-sma",
    }).toJSON();
    const resolver = () => new MovingAverageIndicator();

    expect(() => restoreIndicator(null, resolver)).toThrow(
      "Invalid indicator state: expected an object."
    );
    expect(() => restoreIndicator({ ...state, version: 2 }, resolver)).toThrow(
      'Unsupported indicator state version "2"; expected 1.'
    );
    expect(() => restoreIndicator({ ...state, options: [] }, resolver)).toThrow(
      "Invalid indicator state: options must be an object."
    );
    expect(() =>
      restoreIndicator(
        { ...state, options: { names: { default: "UI value" } } },
        resolver
      )
    ).toThrow(
      "Invalid indicator state: options must not contain label metadata."
    );
    expect(() => restoreIndicator(state, () => undefined)).toThrow(
      'No indicator resolver matched type "moving-average".'
    );
    expect(() => restoreIndicator(state, () => new TestIndicator())).toThrow(
      'Indicator resolver returned type "test" for "moving-average".'
    );
  });
});
