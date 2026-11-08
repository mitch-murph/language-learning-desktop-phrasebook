import { useEffect, useMemo, useRef, useState } from 'react';
import type { Phrase } from '../../api/client';
import { callTts, type Pace } from '../../api/tts';
import { splitIntoChunks } from './chunks';
import { useTtsGate } from './useTtsGate';

// Fragments synthesized so far, shared across modal opens (lost on reload).
const clipCache = new Map<string, string>();

type Direction = 'backward' | 'forward';
type Range = [number, number]; // inclusive chunk indices

interface Props {
  phrase: Phrase;
  onClose: () => void;
}

export default function FocusModal({ phrase, onClose }: Props) {
  const { chunks, joiner } = useMemo(
    () => splitIntoChunks(phrase.text, phrase.languageCode),
    [phrase.text, phrase.languageCode],
  );
  // Romanization is stored for the whole phrase. It can be paired to chunks only
  // when it has exactly one space-separated token per chunk.
  const roman = useMemo(() => {
    const toks = (phrase.transcription ?? '').trim().split(/\s+/).filter(Boolean);
    return phrase.nonLatin && joiner === ' ' && toks.length === chunks.length ? toks : null;
  }, [phrase.transcription, phrase.nonLatin, joiner, chunks.length]);

  const [pace, setPace] = useState<Pace>('normal');
  const [direction, setDirection] = useState<Direction>('backward');
  const [showRoman, setShowRoman] = useState(true);
  const [playing, setPlaying] = useState<Range | null>(null);
  const [loading, setLoading] = useState<Range | null>(null);
  const [preload, setPreload] = useState<{ done: number; total: number } | null>(null);
  const [, bump] = useState(0);
  const [error, setError] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gate = useTtsGate(e => setError(e instanceof Error ? e.message : String(e)));

  const n = chunks.length;
  const textOf = ([s, e]: Range) => chunks.slice(s, e + 1).join(joiner);
  const same = (a: Range | null, b: Range) => !!a && a[0] === b[0] && a[1] === b[1];

  // Build-up rows: backward grows leftward from the last chunk, forward rightward.
  const steps = useMemo<Range[]>(
    () => Array.from({ length: n }, (_, i): Range => (direction === 'backward' ? [n - 1 - i, n - 1] : [0, i])),
    [n, direction],
  );

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }
  useEffect(() => stop, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cacheKey = (text: string) => `${pace}|${phrase.languageCode}|${phrase.languageName}|${text}`;

  async function fetchClip(text: string): Promise<string> {
    const key = cacheKey(text);
    let b64 = clipCache.get(key);
    if (!b64) {
      b64 = await callTts(text, phrase.languageCode, pace, phrase.languageName);
      clipCache.set(key, b64);
    }
    return b64;
  }

  async function play(range: Range) {
    const wasPlaying = same(playing, range);
    stop();
    if (wasPlaying) return;
    setError('');
    setLoading(range);
    await gate.run(async () => {
      try {
        const b64 = await fetchClip(textOf(range));
        const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
        audio.onended = () => {
          if (audioRef.current === audio) stop();
        };
        audioRef.current = audio;
        setPlaying(range);
        await audio.play();
      } finally {
        setLoading(l => (same(l, range) ? null : l));
      }
    });
  }

  // Every distinct fragment this view can play, for the current pace.
  const preloadTexts = [...new Set([...chunks, ...steps.map(textOf), phrase.text.trim()])];
  const allCached = preloadTexts.every(t => clipCache.has(cacheKey(t)));

  async function preloadAll() {
    if (preload) return;
    setError('');
    await gate.run(async () => {
      const texts = preloadTexts;
      setPreload({ done: texts.filter(t => clipCache.has(cacheKey(t))).length, total: texts.length });
      try {
        for (const t of texts) {
          await fetchClip(t);
          setPreload({ done: texts.filter(x => clipCache.has(cacheKey(x))).length, total: texts.length });
        }
      } finally {
        setPreload(null);
        bump(x => x + 1);
      }
    });
  }

  /** The phrase as inline clickable text. `lit` is the range drawn at full strength. */
  function line(lit: Range, opts: { perChunk: boolean; showRoman: boolean; big?: boolean }) {
    return (
      <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
        {chunks.map((c, i) => {
          const inLit = i >= lit[0] && i <= lit[1];
          const isPlaying = !!playing && i >= playing[0] && i <= playing[1];
          const isLoading = !!loading && i >= loading[0] && i <= loading[1];
          const body = (
            <>
              <span className={opts.big ? 'text-2xl' : 'text-lg'}>{c}</span>
              {opts.showRoman && roman && (
                <span className="text-xs italic text-slate-400">{roman[i]}</span>
              )}
            </>
          );
          const cls = `inline-flex flex-col items-start rounded px-1.5 py-0.5 transition-colors ${
            inLit ? 'text-slate-900' : 'text-slate-300'
          }`;
          if (!opts.perChunk) return <span key={i} className={cls}>{body}</span>;
          return (
            <span
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => void play([i, i])}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && void play([i, i])}
              className={`${cls} cursor-pointer select-none ${
                isPlaying ? 'bg-blue-100 text-blue-800' : isLoading ? 'animate-pulse bg-slate-100' : 'hover:bg-slate-100'
              }`}
            >
              {body}
            </span>
          );
        })}
      </span>
    );
  }

  const seg = 'rounded px-2.5 py-1 text-xs font-medium';
  const segOn = 'bg-slate-800 text-white';
  const segOff = 'bg-slate-100 text-slate-600 hover:bg-slate-200';
  const whole: Range = [0, Math.max(0, n - 1)];

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Focus on phrase"
          className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{phrase.languageName}</p>
              {phrase.translation && <p className="mt-0.5 text-sm text-slate-600">{phrase.translation}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(['normal', 'slow'] as Pace[]).map(p => (
                <button key={p} type="button" onClick={() => setPace(p)} className={`${seg} ${pace === p ? segOn : segOff}`}>
                  {p}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['backward', 'forward'] as Direction[]).map(d => (
                <button key={d} type="button" onClick={() => setDirection(d)} className={`${seg} ${direction === d ? segOn : segOff}`}>
                  {d === 'backward' ? 'from end' : 'from start'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowRoman(v => !v)}
              disabled={!roman}
              title={roman ? undefined : 'Romanization does not line up with the parts for this phrase'}
              className={`${seg} ${showRoman && roman ? segOn : segOff} disabled:opacity-40`}
            >
              romanization
            </button>
            <button
              type="button"
              onClick={() => void preloadAll()}
              disabled={!!preload || allCached}
              className={`${seg} ${segOff} ml-auto min-w-[8.5rem] tabular-nums disabled:cursor-default ${
                preload ? 'animate-pulse' : allCached ? 'text-emerald-700' : ''
              } disabled:opacity-100`}
            >
              {preload ? `Loading ${preload.done}/${preload.total}…` : allCached ? '✓ Audio loaded' : 'Preload audio'}
            </button>
          </div>

          {error && <p className="mt-3 break-words rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <p className="mt-5 text-xs font-medium uppercase tracking-wide text-slate-400">Click a part</p>
          <div className="mt-1">{line(whole, { perChunk: true, showRoman: showRoman && !!roman, big: true })}</div>
          {phrase.transcription && !roman && (
            <p className="mt-1 px-1.5 text-sm italic text-slate-400">{phrase.transcription}</p>
          )}

          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-400">
            Build up {direction === 'backward' ? 'from the end' : 'from the start'} — click a line
          </p>
          <div className="mt-1 flex flex-col">
            {steps.map(r => (
              <div
                key={`${r[0]}-${r[1]}`}
                role="button"
                tabIndex={0}
                onClick={() => void play(r)}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && void play(r)}
                className={`cursor-pointer select-none rounded px-1 py-1 ${
                  same(playing, r) ? 'bg-blue-50' : same(loading, r) ? 'animate-pulse bg-slate-50' : 'hover:bg-slate-50'
                }`}
              >
                {line(r, { perChunk: false, showRoman: false })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {gate.tokenModal}
    </>
  );
}
