// 外部ソース由来の URL を href に置くための関数。javascript: や data: による XSS を防ぐ。
// 不正な URL は null を返し、呼び出し側でリンクを出さない（href="#" + target="_blank" は同じページを新規タブで開いてしまう）。
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}
