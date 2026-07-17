import { vi } from "vitest";

process.env.TZ = "UTC";

class ResizeObserverMock implements ResizeObserver {
  constructor(readonly callback: ResizeObserverCallback) {}

  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

class CanvasGradientMock implements CanvasGradient {
  addColorStop = vi.fn();
}

class Path2DMock implements Path2D {
  addPath = vi.fn();
  closePath = vi.fn();
  lineTo = vi.fn();
  moveTo = vi.fn();
  rect = vi.fn();
  arc = vi.fn();
  arcTo = vi.fn();
  bezierCurveTo = vi.fn();
  ellipse = vi.fn();
  quadraticCurveTo = vi.fn();
  roundRect = vi.fn();
}

Object.defineProperty(globalThis, "Path2D", {
  configurable: true,
  writable: true,
  value: Path2DMock
});

const createCanvasContext = (
  canvas: HTMLCanvasElement
): Partial<CanvasRenderingContext2D> => ({
  canvas,
  fillStyle: "#000",
  font: "12px monospace",
  lineWidth: 1,
  strokeStyle: "#000",
  textAlign: "start",
  textBaseline: "alphabetic",
  beginPath: vi.fn(),
  arc: vi.fn(),
  clearRect: vi.fn(),
  clip: vi.fn(),
  closePath: vi.fn(),
  createLinearGradient: vi.fn(() => new CanvasGradientMock()),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  lineTo: vi.fn(),
  measureText: vi.fn((text: string): TextMetrics => {
    const width = text.length * 7;

    return {
      actualBoundingBoxAscent: 0,
      actualBoundingBoxDescent: 0,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: width,
      alphabeticBaseline: 0,
      emHeightAscent: 0,
      emHeightDescent: 0,
      fontBoundingBoxAscent: 0,
      fontBoundingBoxDescent: 0,
      hangingBaseline: 0,
      ideographicBaseline: 0,
      width,
    };
  }),
  moveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  rect: vi.fn(),
  restore: vi.fn(),
  save: vi.fn(),
  scale: vi.fn(),
  setLineDash: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
});

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "requestAnimationFrame", {
  configurable: true,
  writable: true,
  value: (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 0),
});

Object.defineProperty(globalThis, "cancelAnimationFrame", {
  configurable: true,
  writable: true,
  value: (handle: number) => clearTimeout(handle),
});

Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  configurable: true,
  get() {
    const element = this as HTMLElement;
    if (element.style.width.endsWith("px")) {
      return Number.parseFloat(element.style.width);
    }
    return element.parentElement?.offsetWidth || 800;
  },
});

Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  configurable: true,
  get() {
    const element = this as HTMLElement;
    if (element.style.height.endsWith("px")) {
      return Number.parseFloat(element.style.height);
    }
    return element.parentElement?.offsetHeight || 400;
  },
});

const canvasContexts = new WeakMap<
  HTMLCanvasElement,
  CanvasRenderingContext2D
>();

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  configurable: true,
  writable: true,
  value: vi.fn(function getContext(
    this: HTMLCanvasElement,
    contextId: string
  ) {
    if (contextId !== "2d") return null;
    const existing = canvasContexts.get(this);
    if (existing) return existing;
    const context = createCanvasContext(this) as CanvasRenderingContext2D;
    canvasContexts.set(this, context);
    return context;
  }),
});
