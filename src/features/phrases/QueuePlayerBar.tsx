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
  volume: number;
  onSetMode: (m: QueueMode) => void;
  onTogglePlay: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
  onStop: () => void;
  onVolumeChange: (v: number) => void;
}

export default function QueuePlayerBar({
  phrase,
  index,
  total,
  playing,
  mode,
  volume,
  onSetMode,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onStop,
  onVolumeChange,
}: Props) {
  if (!phrase) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-4 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          {(Object.keys(MODE_LABEL) as QueueMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => onSetMode(m)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
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
            className="rounded px-2.5 py-1.5 text-base text-slate-600 hover:bg-slate-100"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="flex w-10 items-center justify-center rounded bg-slate-800 py-1.5 text-base font-medium text-white hover:bg-slate-700"
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            onClick={onSkipNext}
            aria-label="Next phrase"
            className="rounded px-2.5 py-1.5 text-base text-slate-600 hover:bg-slate-100"
          >
            ⏭
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-slate-800">{phrase.text}</p>
          {(phrase.transcription || phrase.translation) && (
            <p className="truncate text-sm text-slate-400">
              {[phrase.transcription, phrase.translation].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        <span className="whitespace-nowrap text-right text-xs tabular-nums text-slate-400">
          {index + 1} / {total}
        </span>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={e => onVolumeChange(Number(e.target.value))}
          aria-label="Volume"
          className="w-20 accent-blue-600"
        />

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
