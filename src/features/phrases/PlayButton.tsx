interface Props {
  /** Glyph shown when idle: ▶ for normal speed, ½ for slow (as in the mobile quiz). */
  glyph: string;
  /** Tooltip and accessible name. */
  title: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function PlayButton({ glyph, title, active, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 max-sm:h-9 max-sm:w-9 ${
        active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {active ? '■' : glyph}
    </button>
  );
}
