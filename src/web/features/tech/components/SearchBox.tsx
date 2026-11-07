import { useEffect, useState } from 'react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

// URL に直接つなぐと、更新が戻ってくるまでの間に入力中の文字が巻き戻るため、入力欄は手元の state で持つ
export function SearchBox({ value, onChange, label = '記事を検索' }: SearchBoxProps) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <input
      type="search"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
      aria-label={label}
      placeholder={label}
      className="w-full rounded-md border border-border bg-surface-raised px-3 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none sm:max-w-xs"
    />
  );
}
