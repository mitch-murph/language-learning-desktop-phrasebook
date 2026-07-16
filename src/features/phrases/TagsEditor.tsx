import { useState, type FocusEvent, useRef } from 'react';

interface Props {
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
}

// How many tags show in the collapsed, always-fixed-height preview row before
// folding the rest behind a "+N" toggle. Editing (add/remove) only happens in
// the popover below, so this number never affects row height.
const COLLAPSED_VISIBLE = 2;

export default function TagsEditor({ tags, suggestions, onChange }: Props) {
  const [draft, setDraft] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const overflowCount = Math.max(0, tags.length - COLLAPSED_VISIBLE);

  function handleBlur(e: FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setPopoverOpen(false);
      setSuggestOpen(false);
      if (draft.trim()) addTag(draft);
    }
  }

  return (
    <div ref={containerRef} className="relative min-w-[120px]" onBlur={handleBlur}>
      <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
        {tags.slice(0, COLLAPSED_VISIBLE).map(tag => (
          <span
            key={tag}
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700"
          >
            {tag}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setPopoverOpen(o => !o)}
          className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
        >
          {overflowCount > 0 ? `+${overflowCount}` : '+ tag'}
        </button>
      </div>
      {popoverOpen && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white p-2 shadow-md">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700"
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
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(draft);
                } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
                  removeTag(tags[tags.length - 1]);
                } else if (e.key === 'Escape') {
                  setPopoverOpen(false);
                  setSuggestOpen(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="+ tag"
              className="min-w-[64px] flex-1 border-none bg-transparent text-xs outline-none placeholder:text-slate-400"
            />
          </div>
          {suggestOpen && options.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border-t border-slate-100 pt-1">
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
      )}
    </div>
  );
}
