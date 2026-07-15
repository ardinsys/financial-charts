export function disposeInOrder(disposers: readonly (() => void)[]): void {
  let firstError: unknown;
  for (const dispose of disposers) {
    try {
      dispose();
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError !== undefined) throw firstError;
}
