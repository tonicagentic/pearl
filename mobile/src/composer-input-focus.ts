/** Bridge so chrome controls (model sheet, etc.) can restore the composer field. */

let focusHandler: (() => void) | null = null;

export function registerComposerInputFocus(focus: () => void): () => void {
  focusHandler = focus;
  return () => {
    if (focusHandler === focus) focusHandler = null;
  };
}

export function focusComposerInput(): void {
  focusHandler?.();
}
