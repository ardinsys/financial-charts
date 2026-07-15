import { describe, expect, it, vi } from "vitest";
import { disposeInOrder } from "../src/utils/dispose";

describe("disposeInOrder", () => {
  it("runs every disposer in order and rethrows the first failure", () => {
    const calls: string[] = [];
    const firstError = new Error("first");

    expect(() =>
      disposeInOrder([
        () => calls.push("interaction"),
        () => {
          calls.push("extensions");
          throw firstError;
        },
        () => {
          calls.push("panes");
          throw new Error("second");
        },
        () => calls.push("dom")
      ])
    ).toThrow(firstError);

    expect(calls).toEqual(["interaction", "extensions", "panes", "dom"]);
  });

  it("does not throw when every disposer succeeds", () => {
    const dispose = vi.fn();

    expect(() => disposeInOrder([dispose])).not.toThrow();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
