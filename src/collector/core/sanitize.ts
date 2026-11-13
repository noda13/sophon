export const SECRET_ENV_KEYS = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'JQUANTS_API_KEY', 'RSSHUB_URL'] as const;

export const MAX_ERROR_LENGTH = 200;
const MIN_SECRET_LENGTH = 4;
const URL_PATTERN = /https?:\/\/[^\s"'<>)\]]+/g;

// errors は公開リポジトリの data ブランチと Pages にそのまま載る。Actions のログマスクは効かないので、
// 書き出す前に秘密値と URL（RSSHUB_URL を含む feed URL など）を自前で落とす。
//
// maxLength は run.errors 用の既定 200 文字。診断ログのように長く残したい用途だけ上書きする。
export function sanitizeError(
  message: string,
  env: Record<string, string | undefined> = {},
  maxLength: number = MAX_ERROR_LENGTH,
): string {
  const secrets = SECRET_ENV_KEYS.map((key) => env[key])
    .filter((v): v is string => typeof v === 'string' && v.length >= MIN_SECRET_LENGTH)
    .sort((a, b) => b.length - a.length);

  // URL を先に落とすと、RSSHUB_URL 配下のパス（feed 名）まで残らない。
  let out = message.replace(URL_PATTERN, '<url>');
  for (const secret of secrets) out = out.split(secret).join('***');
  out = out.replace(/\s*[\r\n]+\s*/g, ' ').trim();
  return out.length > maxLength ? `${out.slice(0, maxLength - 1)}…` : out;
}
