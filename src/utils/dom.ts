import { pixelRatio } from "./screen";

export type Dispose = () => void;

type CssLength = number | string;
type EventOptions = boolean | AddEventListenerOptions;

export interface ElementBounds {
  x?: CssLength;
  y?: CssLength;
  left?: CssLength;
  top?: CssLength;
  right?: CssLength;
  bottom?: CssLength;
  width?: CssLength;
  height?: CssLength;
}

export interface PositionedContainerOptions extends ElementBounds {
  className?: string | readonly string[];
  position?: CSSStyleDeclaration["position"];
  overflow?: CSSStyleDeclaration["overflow"];
  userSelect?: CSSStyleDeclaration["userSelect"];
  tapHighlightColor?: string;
  zIndex?: number | string;
  backgroundColor?: string;
  borderTop?: string;
}

export interface CanvasLayerOptions extends Omit<
  ElementBounds,
  "width" | "height"
> {
  width: number;
  height: number;
  pixelRatio?: number;
  context?: CanvasRenderingContext2D;
}

type TapHighlightStyle = CSSStyleDeclaration & {
  webkitTapHighlightColor?: string;
};

const toCssLength = (value: CssLength) =>
  typeof value === "number" ? `${value}px` : value;

export function setElementBounds(
  element: HTMLElement,
  bounds: ElementBounds
): void {
  const left = bounds.left ?? bounds.x;
  const top = bounds.top ?? bounds.y;

  if (left !== undefined) element.style.left = toCssLength(left);
  if (top !== undefined) element.style.top = toCssLength(top);
  if (bounds.right !== undefined)
    element.style.right = toCssLength(bounds.right);
  if (bounds.bottom !== undefined) {
    element.style.bottom = toCssLength(bounds.bottom);
  }
  if (bounds.width !== undefined)
    element.style.width = toCssLength(bounds.width);
  if (bounds.height !== undefined) {
    element.style.height = toCssLength(bounds.height);
  }
}

export function configurePositionedElement(
  element: HTMLElement,
  options: PositionedContainerOptions = {}
): void {
  if (options.position !== undefined) element.style.position = options.position;
  if (options.overflow !== undefined) element.style.overflow = options.overflow;
  if (options.userSelect !== undefined)
    element.style.userSelect = options.userSelect;
  if (options.tapHighlightColor !== undefined) {
    (element.style as TapHighlightStyle).webkitTapHighlightColor =
      options.tapHighlightColor;
  }
  if (options.zIndex !== undefined)
    element.style.zIndex = String(options.zIndex);
  if (options.backgroundColor !== undefined) {
    element.style.backgroundColor = options.backgroundColor;
  }
  if (options.borderTop !== undefined)
    element.style.borderTop = options.borderTop;

  setElementBounds(element, options);
}

export function createPositionedContainer(
  options: PositionedContainerOptions = {}
): HTMLDivElement {
  const element = document.createElement("div");
  configurePositionedElement(element, {
    position: "absolute",
    ...options
  });

  if (options.className) {
    const classNames =
      typeof options.className === "string"
        ? [options.className]
        : options.className;
    element.classList.add(...classNames);
  }

  return element;
}

export function createCanvasLayer(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.userSelect = "none";
  (canvas.style as TapHighlightStyle).webkitTapHighlightColor = "transparent";
  return canvas;
}

export function scaleCanvasContext(
  context: CanvasRenderingContext2D,
  ratio = pixelRatio()
): void {
  context.scale(ratio, ratio);
}

export function alignStroke(value: number, width: number): number {
  return Math.round(value) + (Math.round(width) % 2 === 0 ? 0 : 0.5);
}

export function resizeCanvasLayer(
  canvas: HTMLCanvasElement,
  options: CanvasLayerOptions
): void {
  const ratio = options.pixelRatio ?? pixelRatio();

  setElementBounds(canvas, options);
  canvas.width = Math.max(0, Math.round(options.width * ratio));
  canvas.height = Math.max(0, Math.round(options.height * ratio));

  if (options.context) {
    scaleCanvasContext(options.context, ratio);
  }
}

export function bindEvent<K extends keyof HTMLElementEventMap>(
  target: HTMLElement,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
  options?: EventOptions
): Dispose;
export function bindEvent<K extends keyof WindowEventMap>(
  target: Window,
  type: K,
  listener: (event: WindowEventMap[K]) => void,
  options?: EventOptions
): Dispose;
export function bindEvent(
  target: EventTarget,
  type: string,
  listener: any,
  options?: EventOptions
): Dispose {
  const eventListener = listener as EventListenerOrEventListenerObject;
  target.addEventListener(type, eventListener, options);
  return () => target.removeEventListener(type, eventListener, options);
}
