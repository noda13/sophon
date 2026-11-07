/**
 * Returns the URL only if it uses an allowed scheme (http or https).
 * Returns undefined for javascript:, data:, vbscript:, or other dangerous schemes.
 * Use this for any external URLs sourced from the API before placing them in href.
 */
export function safeHref(url?: string | null): string | undefined {
  if (!url) return undefined;
  return /^https?:\/\//i.test(url) ? url : undefined;
}
