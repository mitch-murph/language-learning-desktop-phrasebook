interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  language: string;
  onLanguageChange: (v: string) => void;
  languages: string[];
  tag: string;
  onTagChange: (v: string) => void;
  tags: string[];
  count: number;
}

export default function Toolbar({
  search,
  onSearchChange,
  language,
  onLanguageChange,
  languages,
  tag,
  onTagChange,
  tags,
  count,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Search phrase, romanization, translation…"
        className="min-w-[260px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
      <select
        value={language}
        onChange={e => onLanguageChange(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      >
        <option value="">All languages</option>
        {languages.map(l => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <select
        value={tag}
        onChange={e => onTagChange(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      >
        <option value="">All tags</option>
        {tags.map(t => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <span className="ml-auto whitespace-nowrap text-sm text-slate-500">
        {count} phrase{count === 1 ? '' : 's'}
      </span>
    </div>
  );
}
