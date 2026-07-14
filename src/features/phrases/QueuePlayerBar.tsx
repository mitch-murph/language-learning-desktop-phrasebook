import type { Phrase } from '../../api/client';
import type { QueueMode } from './useQueuePlayer';

const MODE_LABEL: Record<QueueMode, string> = {
  normal: 'Normal',
  slow: 'Slow',
  drill: 'Drill',
  recall: 'Recall',
  recallDrill: 'Recall Drill',
};

interface Props {
  phrase: Phrase | undefined;
  index: number;
  total: number;
  playing: boolean;
  mode: QueueMode;
  onSetMode: (m: QueueMode) => void;
  onTogglePlay: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
  onStop: () => void;
}

export default function QueuePlayerBar({
  phrase,
  index,
  total,
  playing,
  mode,
  onSetMode,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onStop,
}: Props) {
  if (!phrase) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {(Object.keys(MODE_LABEL) as QueueMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onSetMode(m)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSkipPrev}
            aria-label="Previous phrase"
            className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="rounded bg-slate-800 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700"
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            onClick={onSkipNext}
            aria-label="Next phrase"
            className="rounded px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            ⏭
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{phrase.text}</p>
          {phrase.translation && <p className="truncate text-xs text-slate-400">{phrase.translation}</p>}
        </div>

        <span className="whitespace-nowrap text-right text-xs tabular-nums text-slate-400">
          {index + 1} / {total}
        </span>

        <button
          type="button"
          onClick={onStop}
          className="rounded px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
