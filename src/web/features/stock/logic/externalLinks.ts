export interface ExternalLink {
  label: string;
  url: string;
  description: string;
}

function yyyymmdd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}${m}${d}`;
}

export function buildExternalLinks(code: string, now: Date = new Date()): ExternalLink[] {
  const safeCode = encodeURIComponent(code);
  return [
    { label: 'kabutan', url: `https://kabutan.jp/stock/?code=${safeCode}`, description: '株価・ニュース' },
    { label: 'IR BANK', url: `https://irbank.net/E${safeCode}/financials`, description: '財務データ推移' },
    {
      label: 'EDINET',
      url: `https://disclosure2.edinet-fsa.go.jp/WEEK0010.aspx?bikou2=${safeCode}`,
      description: '有価証券報告書',
    },
    {
      label: 'TDnet',
      url: `https://www.release.tdnet.info/inbs/I_list_001_${yyyymmdd(now)}.html`,
      description: '適時開示（本日）',
    },
  ];
}
