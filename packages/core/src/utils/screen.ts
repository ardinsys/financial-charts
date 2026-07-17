export function pixelRatio() {
  return Math.round((window.devicePixelRatio || 1) * 1000) / 1000;
}
