/**
 * Minimal stand-in for the `obsidian` runtime module so unit tests can import
 * plugin code without the real Obsidian environment. Only the surface our pure
 * helpers depend on is implemented.
 *
 * `normalizePath` mirrors Obsidian's behavior: backslashes become forward
 * slashes, repeated slashes collapse, surrounding whitespace and slashes are
 * trimmed, and an empty result becomes the vault root `'/'`.
 */
export function normalizePath(path: string): string {
  const cleaned = path
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .trim()
    .replace(/(^\/+|\/+$)/g, '');
  return cleaned === '' ? '/' : cleaned;
}

/** Tests run against the English locale. */
export function getLanguage(): string {
  return 'en';
}

/**
 * Obsidian's `setTooltip` wires up a hover tooltip; for assertions we just
 * mirror the text onto `aria-label`, which is the part tests can observe.
 */
export function setTooltip(el: HTMLElement, tooltip: string): void {
  el.setAttribute('aria-label', tooltip);
}
