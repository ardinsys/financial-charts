export function paletteColor(colors: readonly string[], index: number): string {
  if (colors.length === 0) {
    throw new RangeError("The color palette must not be empty");
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError("The palette index must be a non-negative integer");
  }

  return colors[index % colors.length];
}
