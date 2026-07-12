interface Props {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function PlayButton({ label, active, disabled, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {active ? '■' : '▶'} {label}
    </button>
  );
}
