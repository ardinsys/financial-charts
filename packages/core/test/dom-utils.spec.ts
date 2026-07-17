import { describe, expect, it, vi } from "vitest";
import {
  bindEvent,
  createCanvasLayer,
  createPositionedContainer,
  resizeCanvasLayer
} from "../src/utils/dom";

describe("DOM utilities", () => {
  it("creates positioned containers with bounds and classes", () => {
    const container = createPositionedContainer({
      className: ["chart-layer", "active"],
      position: "relative",
      overflow: "hidden",
      left: 12,
      top: 8,
      width: "100%",
      height: 240,
      zIndex: 5,
      backgroundColor: "#fff"
    });

    expect(container.tagName).toBe("DIV");
    expect(container.classList.contains("chart-layer")).toBe(true);
    expect(container.classList.contains("active")).toBe(true);
    expect(container.style.position).toBe("relative");
    expect(container.style.overflow).toBe("hidden");
    expect(container.style.left).toBe("12px");
    expect(container.style.top).toBe("8px");
    expect(container.style.width).toBe("100%");
    expect(container.style.height).toBe("240px");
    expect(container.style.zIndex).toBe("5");
    expect(container.style.backgroundColor).not.toBe("");
  });

  it("creates and resizes HiDPI canvas layers", () => {
    const canvas = createCanvasLayer();
    const context = canvas.getContext("2d")!;

    resizeCanvasLayer(canvas, {
      left: 4,
      top: 6,
      width: 200,
      height: 120,
      pixelRatio: 2,
      context
    });

    expect(canvas.style.position).toBe("absolute");
    expect(canvas.style.userSelect).toBe("none");
    expect(canvas.style.left).toBe("4px");
    expect(canvas.style.top).toBe("6px");
    expect(canvas.style.width).toBe("200px");
    expect(canvas.style.height).toBe("120px");
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(240);
    expect(context.scale).toHaveBeenCalledWith(2, 2);
  });

  it("binds events and returns a disposer", () => {
    const button = document.createElement("button");
    const listener = vi.fn();
    const dispose = bindEvent(button, "click", listener);

    button.click();
    dispose();
    button.click();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
