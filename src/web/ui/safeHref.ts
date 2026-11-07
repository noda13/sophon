// 外部ソース由来の URL を href に置くための関数。javascript: や data: による XSS を防ぐ。
export function safeHref(url: string | null | undefined): string {
  if (!url) return '#';
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : '#';
}
