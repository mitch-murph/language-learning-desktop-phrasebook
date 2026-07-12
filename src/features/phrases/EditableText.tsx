import { useEffect, useState } from 'react';

interface Props {
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
  italic?: boolean;
}

export default function EditableText({ value, placeholder, onCommit, italic }: Props) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  function commit() {
    if (draft !== value) onCommit(draft);
  }

  return (
    <input
      value={draft}
      placeholder={placeholder}
      title={value || undefined}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={`w-full min-w-0 truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-slate-400 hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400 ${italic ? 'italic text-slate-500' : ''}`}
    />
  );
}
