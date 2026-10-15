import type { Phrase } from '../../api/client';
import { QUEUE_MODE_LABEL, QUEUE_MODES, type QueueMode } from './useQueuePlayer';
import { StopIcon } from './icons';

// Compact labels for the xl+ segmented control; QUEUE_MODE_LABEL is the full name.
const MODE_SHORT_LABEL: Record<QueueMode, string> = {
  normal: 'Normal',
  slow: 'Slow',
  fast: 'Fast',
  drill: 'Drill',
  fastDrill: 'Fast Drill',
  recall: 'Recall',
  recallDrill: 'Recall Drill',
  reverseRecall: 'Reverse',
};

interface Props {
  phrase: Phrase | undefined;
  index: number;
  total: number;
  playing: boolean;
  mode: QueueMode;
  volume: number;
  bufferedCount: number;
  bufferTotal: number;
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
  bufferedCount,
  bufferTotal,
  onSetMode,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  onStop,
  onVolumeChange,
}: Props) {
  if (!phrase) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] backdrop-blur sm:py-4">
      {/* Phones: text on top, one controls row below. sm+: a single row —
          transport + counter on the left, the text taking the remaining width
          in the middle, mode + volume on the right. The controls wrapper uses
          `sm:contents` so its children join the outer row and are placed with
          `order`. */}
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        {/* Phrase, romanization and translation each on their own line(s),
            wrapping up to two lines each before truncating. The min-height
            reserves one line apiece so short phrases (with or without a
            romanization) don't change the bar's height. */}
        <div className="min-h-[4.5rem] min-w-0 break-words sm:order-2 sm:flex-1">
          <p className="line-clamp-2 text-base font-semibold leading-snug text-slate-800 sm:text-lg">{phrase.text}</p>
          {phrase.transcription && (
            <p className="line-clamp-2 text-sm italic leading-snug text-slate-500">{phrase.transcription}</p>
          )}
          {phrase.translation && (
            <p className="line-clamp-2 text-sm leading-snug text-slate-400">{phrase.translation}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:contents">
          <div className="flex shrink-0 items-center gap-1 sm:order-1">
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
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              title="Stop"
              className="rounded px-2.5 py-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <StopIcon />
            </button>
          </div>

          <span className="ml-auto shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-slate-400 sm:order-1 sm:ml-0">
            {index + 1} / {total}
          </span>

          {/* Phones: line break, then mode picker + buffering on their own row. */}
          <div className="basis-full sm:hidden" />

          {/* Below xl the mode is a dropdown (phones: fills the leftover width). */}
          <select
            value={mode}
            onChange={e => onSetMode(e.target.value as QueueMode)}
            aria-label="Playback mode"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:order-3 sm:flex-none xl:hidden"
          >
            {QUEUE_MODES.map(m => (
              <option key={m} value={m}>
                {QUEUE_MODE_LABEL[m]}
              </option>
            ))}
          </select>

          {/* xl+: one-click segmented row (full names in the tooltips). */}
          <div className="hidden shrink-0 gap-0.5 rounded-md bg-slate-100 p-0.5 sm:order-3 xl:flex">
            {QUEUE_MODES.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => onSetMode(m)}
                title={QUEUE_MODE_LABEL[m]}
                aria-pressed={mode === m}
                className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${
                  mode === m ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {MODE_SHORT_LABEL[m]}
              </button>
            ))}
          </div>


          <span
            className={`ml-auto min-w-[110px] whitespace-nowrap text-right text-xs tabular-nums text-amber-600 sm:order-4 sm:ml-0 ${
              bufferedCount >= bufferTotal ? 'invisible pointer-events-none' : ''
            }`}
          >
            Buffering {bufferedCount}/{bufferTotal}
          </span>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={e => onVolumeChange(Number(e.target.value))}
            aria-label="Volume"
            className="hidden w-20 shrink-0 accent-blue-600 sm:order-5 sm:block"
          />
        </div>
      </div>
    </div>
  );
}
