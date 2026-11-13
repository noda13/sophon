# sophon

## LLM の構造化出力

- スキーマで省略できる値は `.optional()` ではなく `.nullable()` にする。Groq の strict `response_format` は、`properties` の全キーを `required` に入れないと 400 で拒否する。受け取った後に `?? undefined` で変換する（`src/collector/sources/econ/assess.ts`）。
- プロンプトに応答形（例: `{"results":[...]}`）を書き、「items など別の階層を挟まない」と明記する。書かないと `gpt-oss-120b` が配列を `{"items":[...]}` で包んで返す。
