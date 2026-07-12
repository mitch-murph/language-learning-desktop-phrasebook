import { useState } from 'react';

interface Props {
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}

export default function TagsEditor({ tags, suggestions, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  function addTag(value: string) {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setDraft('');
  }

  function removeTag(tag: string) {
    onChange(tags.filter(t => t !== tag));
  }

  const options = suggestions.filter(
    s => !tags.includes(s) && s.toLowerCase().includes(draft.trim().toLowerCase()),
  );

  return (
    <div className="relative min-w-[160px]">
      <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
        {tags.map(tag => (
          <span
            key={tag}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-slate-500 hover:text-slate-900"
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            if (draft.trim()) addTag(draft);
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag(draft);
            } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
              removeTag(tags[tags.length - 1]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="+ tag"
          className="w-12 min-w-0 shrink-0 border-none bg-transparent text-xs outline-none placeholder:text-slate-400"
        />
      </div>
      {open && options.length > 0 && (
        <div className="absolute left-0 top-full z-10 mt-1 max-h-40 w-40 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-md">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => {
                // preventDefault keeps the input focused so blur doesn't fire,
                // letting multiple suggestions be clicked in a row
                e.preventDefault();
                addTag(opt);
              }}
              className="block w-full truncate px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
