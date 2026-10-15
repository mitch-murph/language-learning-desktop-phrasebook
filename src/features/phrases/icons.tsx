// Small inline icons shared across the phrase UI. All use currentColor so the
// parent's text color tints them.

const base = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  'aria-hidden': true,
} as const;

export function GearIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size}>
      <circle cx="10" cy="10" r="2.5" />
      <path
        d="M10 1.8v2.4M10 15.8v2.4M1.8 10h2.4M15.8 10h2.4M4.2 4.2l1.7 1.7M14.1 14.1l1.7 1.7M4.2 15.8l1.7-1.7M14.1 5.9l1.7-1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LockIcon({ unlocked, size = 16 }: { unlocked: boolean; size?: number }) {
  return (
    <svg {...base} width={size} height={size}>
      <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
      <path d={unlocked ? 'M7 9V6.5a3 3 0 0 1 5.8-1' : 'M7 9V6.5a3 3 0 0 1 6 0V9'} strokeLinecap="round" />
    </svg>
  );
}

export function EyeIcon({ crossed, size = 14 }: { crossed: boolean; size?: number }) {
  return (
    <svg {...base} width={size} height={size} strokeWidth={1.6}>
      <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" />
      <circle cx="10" cy="10" r="2.4" />
      {crossed && <path d="M3 17 17 3" strokeLinecap="round" />}
    </svg>
  );
}

export function StopIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
    </svg>
  );
}

export function RefreshIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M16.5 10a6.5 6.5 0 1 1-2-4.7" strokeLinecap="round" />
      <path d="M15 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.7 10a1.5 1.5 0 0 0 1.5 1.5h5.6a1.5 1.5 0 0 0 1.5-1.5l.7-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
