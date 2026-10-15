import { useEffect, useRef, useState } from 'react';
import { getAudioUrl, type Phrase } from '../../api/client';

export type QueueMode = 'normal' | 'slow' | 'fast' | 'drill' | 'fastDrill' | 'recall' | 'recallDrill' | 'reverseRecall';

// Display names, in the order modes are offered in menus.
export const QUEUE_MODE_LABEL: Record<QueueMode, string> = {
  normal: 'Normal',
  slow: 'Slow',
  fast: 'Fast',
  drill: 'Drill',
  fastDrill: 'Fast Drill',
  recall: 'Recall',
  recallDrill: 'Recall Drill',
  reverseRecall: 'Reverse Recall',
};
export const QUEUE_MODES = Object.keys(QUEUE_MODE_LABEL) as QueueMode[];

interface Segment {
  kind: 'audio' | 'gap';
  src?: 'normal' | 'slow' | 'translation';
  scale?: number;
  minMs?: number;
  maxMs?: number;
}

function resolveGapMs(seg: Segment, lastAudioDurationSec: number): number {
  const raw = lastAudioDurationSec * 1000 * (seg.scale ?? 0);
  const floored = Math.max(seg.minMs ?? 0, raw);
  return seg.maxMs != null ? Math.min(seg.maxMs, floored) : floored;
}

// Mirrors language-learning-drive-phrasebook's src/audio/usePlayer.ts SEQUENCES
// so live playback timing matches the sibling app's sequencer exactly.
const SEQUENCES: Record<QueueMode, Segment[]> = {
  normal: [
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 1.2, minMs: 1500 },
  ],
  slow: [
    { kind: 'audio', src: 'slow' },
    { kind: 'gap', scale: 1.2, minMs: 1500 },
  ],
  // Same clip as normal, just a much shorter gap before the next phrase.
  fast: [
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 0.12, minMs: 120, maxMs: 400 },
  ],
  drill: [
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 0.6, minMs: 700 },
    { kind: 'audio', src: 'slow' },
    { kind: 'gap', scale: 0.6, minMs: 700 },
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 1.2, minMs: 1500 },
  ],
  // The drill sequence with fast-style compressed gaps throughout.
  fastDrill: [
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 0.12, minMs: 120, maxMs: 400 },
    { kind: 'audio', src: 'slow' },
    { kind: 'gap', scale: 0.12, minMs: 120, maxMs: 400 },
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 0.12, minMs: 120, maxMs: 400 },
  ],
  recall: [
    { kind: 'audio', src: 'translation' },
    { kind: 'gap', scale: 2.5, minMs: 4000, maxMs: 12000 },
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 1.5, minMs: 2000 },
  ],
  // Recall's translation lead-in (gap doubled, to give more time to recall
  // before the drill reveal), then a full drill rep.
  recallDrill: [
    { kind: 'audio', src: 'translation' },
    { kind: 'gap', scale: 5, minMs: 8000, maxMs: 24000 },
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 0.6, minMs: 700 },
    { kind: 'audio', src: 'slow' },
    { kind: 'gap', scale: 0.6, minMs: 700 },
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 1.2, minMs: 1500 },
  ],
  // Mirror of recall: the native phrase plays first, then the translation as
  // the reveal (recall's order is translation -> normal).
  reverseRecall: [
    { kind: 'audio', src: 'normal' },
    { kind: 'gap', scale: 2.5, minMs: 4000, maxMs: 12000 },
    { kind: 'audio', src: 'translation' },
    { kind: 'gap', scale: 1.5, minMs: 2000 },
  ],
};

function audioUrl(phrase: Phrase, src: 'normal' | 'slow' | 'translation'): string | undefined {
  if (src === 'normal') return getAudioUrl(phrase.normalS3Key);
  if (src === 'slow') return getAudioUrl(phrase.slowS3Key);
  return phrase.translationS3Key ? getAudioUrl(phrase.translationS3Key) : undefined;
}

// Which clip kinds a mode's sequence actually touches, so prefetching only
// fetches what this mode will play (e.g. 'normal' doesn't bother with the
// 'slow' clip that 'drill' needs).
function neededKinds(mode: QueueMode): Array<'normal' | 'slow' | 'translation'> {
  const kinds = new Set<'normal' | 'slow' | 'translation'>();
  for (const seg of SEQUENCES[mode]) {
    if (seg.kind === 'audio' && seg.src) kinds.add(seg.src);
  }
  return [...kinds];
}

const PREFETCH_CONCURRENCY = 4;

// A silent looping clip to keep the <audio> element "playing" through gaps
// between phrases. If the element actually pauses during a gap, macOS/Chrome
// treat the tab's media session as inactive, so a hardware Play/Pause press
// launches Apple Music instead of reaching our Media Session handlers.
function createSilentLoopUrl(): string {
  const sampleRate = 8000;
  const numSamples = sampleRate; // 1 second, looped
  const dataSize = numSamples; // 8-bit PCM, 1 byte/sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate (1 byte/sample)
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i++) view.setUint8(44 + i, 128); // 8-bit silence midpoint
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

// Skipping/mode-switching reassigns `.src` while a previous play() promise
// may still be pending, which makes the browser reject it with AbortError —
// a benign race, not a real playback failure. Only a genuine error (e.g. an
// autoplay-policy NotAllowedError) should pause the queue.
function playAudio(a: HTMLAudioElement, onRealFailure: () => void) {
  a.play().catch(err => {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    onRealFailure();
  });
}

export interface QueuePlayerApi {
  phrase: Phrase | undefined;
  index: number;
  total: number;
  playing: boolean;
  volume: number;
  setVolume: (v: number) => void;
  skipNext: () => void;
  skipPrev: () => void;
  togglePlay: () => void;
  bufferedCount: number;
  bufferTotal: number;
}

// Plays `queue` on an endless loop (wrapping to the start after the last
// phrase) under `mode`, sequencing normal/slow/translation clips with gaps
// exactly like language-learning-drive-phrasebook's live usePlayer. Pass an
// empty queue to keep the engine idle; pass a new array to (re)start from
// the first phrase.
export function useQueuePlayer(queue: Phrase[], mode: QueueMode): QueuePlayerApi {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const S = useRef({ index, playing, mode });
  S.current = { index, playing, mode };
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segIdxRef = useRef(0);
  const gapElapsedRef = useRef(0);
  const currentGapMsRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Mutually-recursive engine functions live in refs so callbacks always
  // close over the latest state without stale captures.
  const startSegmentRef = useRef<(i: number) => void>(() => {});
  const advanceRef = useRef<(dir: 1 | -1) => void>(() => {});
  const frameRef = useRef<(ts: number) => void>(() => {});

  const silentUrlRef = useRef<string | null>(null);
  function getSilentUrl(): string {
    if (!silentUrlRef.current) silentUrlRef.current = createSilentLoopUrl();
    return silentUrlRef.current;
  }

  function getAudio(): HTMLAudioElement {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      a.volume = volumeRef.current;
      audioRef.current = a;
    }
    return audioRef.current;
  }

  // Prefetch-to-blob buffer: on flaky connections (e.g. a subway tunnel),
  // fetching each clip live as the queue reaches it means a dead zone kills
  // playback. Instead we fetch every clip this queue+mode will need as a
  // blob up front and key the cache by the clip's direct S3 URL; segment
  // playback below prefers the cached blob: URL and only falls back to the
  // live URL for whatever hasn't finished prefetching yet.
  const blobCacheRef = useRef<Map<string, string>>(new Map());
  const prefetchGenRef = useRef(0);
  const [bufferedCount, setBufferedCount] = useState(0);
  const [bufferTotal, setBufferTotal] = useState(0);

  useEffect(() => {
    const gen = ++prefetchGenRef.current;
    const kinds = neededKinds(mode);
    const tasks: string[] = [];
    const needed = new Set<string>();
    for (const phrase of queue) {
      for (const kind of kinds) {
        const url = audioUrl(phrase, kind);
        if (url && !needed.has(url)) {
          needed.add(url);
          tasks.push(url);
        }
      }
    }

    // Drop cached clips this queue/mode no longer needs (a new queue, or a
    // mode switch that dropped a clip kind) so the buffer doesn't grow
    // forever across sessions. Never revoke the URL currently loaded on the
    // audio element — that would cut off whatever's playing right now.
    const currentSrc = audioRef.current?.src;
    for (const [url, blobUrl] of blobCacheRef.current) {
      if (!needed.has(url) && blobUrl !== currentSrc) {
        URL.revokeObjectURL(blobUrl);
        blobCacheRef.current.delete(url);
      }
    }

    setBufferTotal(tasks.length);
    setBufferedCount(tasks.filter(url => blobCacheRef.current.has(url)).length);
    if (tasks.length === 0) return;

    let cancelled = false;
    let cursor = 0;
    let active = 0;

    function pump() {
      if (cancelled || gen !== prefetchGenRef.current) return;
      while (active < PREFETCH_CONCURRENCY && cursor < tasks.length) {
        const url = tasks[cursor++];
        if (blobCacheRef.current.has(url)) continue;
        active++;
        fetch(url)
          .then(res => (res.ok ? res.blob() : Promise.reject(new Error(`buffer fetch failed (${res.status})`))))
          .then(blob => {
            if (cancelled || gen !== prefetchGenRef.current) return;
            blobCacheRef.current.set(url, URL.createObjectURL(blob));
            setBufferedCount(c => c + 1);
          })
          .catch(() => {
            // Leave it uncached — playback falls back to the live URL for
            // this clip, same as before this buffer existed.
          })
          .finally(() => {
            active--;
            pump();
          });
      }
    }
    pump();

    return () => {
      cancelled = true;
    };
  }, [queue, mode]);

  // Release every buffered blob when the player itself unmounts.
  useEffect(() => {
    return () => {
      for (const blobUrl of blobCacheRef.current.values()) URL.revokeObjectURL(blobUrl);
      blobCacheRef.current.clear();
    };
  }, []);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // A plain timer, not requestAnimationFrame, so gaps keep counting down
  // while the tab is backgrounded — this is meant to run unattended.
  const scheduleTick = () => {
    if (!S.current.playing || timerRef.current != null) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      frameRef.current(Date.now());
    }, 100);
  };

  frameRef.current = ts => {
    const seg = SEQUENCES[S.current.mode][segIdxRef.current];
    if (!seg || seg.kind !== 'gap') return;
    if (lastTsRef.current != null) gapElapsedRef.current += ts - lastTsRef.current;
    lastTsRef.current = ts;
    if (gapElapsedRef.current >= currentGapMsRef.current) {
      startSegmentRef.current(segIdxRef.current + 1);
      return;
    }
    scheduleTick();
  };

  startSegmentRef.current = i => {
    const seq = SEQUENCES[S.current.mode];
    if (i >= seq.length) {
      advanceRef.current(1);
      return;
    }
    segIdxRef.current = i;
    const seg = seq[i];
    const phrase = queueRef.current[S.current.index];
    if (!phrase) return;
    const a = getAudio();

    if (seg.kind === 'audio') {
      const directUrl = audioUrl(phrase, seg.src!);
      if (!directUrl) {
        startSegmentRef.current(i + 1);
        return;
      }
      const url = blobCacheRef.current.get(directUrl) ?? directUrl;
      a.loop = false;
      if (a.src !== url) a.src = url;
      try {
        a.currentTime = 0;
      } catch {
        /* not yet seekable */
      }
      if (S.current.playing) playAudio(a, () => setPlaying(false));
    } else {
      // Read the just-finished clip's duration before swapping to silence.
      const lastDuration = isFinite(a.duration) ? a.duration : 0;
      currentGapMsRef.current = resolveGapMs(seg, lastDuration);
      gapElapsedRef.current = 0;
      lastTsRef.current = null;

      const silentUrl = getSilentUrl();
      a.loop = true;
      if (a.src !== silentUrl) a.src = silentUrl;
      if (S.current.playing) playAudio(a, () => setPlaying(false));

      scheduleTick();
    }
  };

  advanceRef.current = dir => {
    const len = queueRef.current.length;
    if (len === 0) return;
    const next = (S.current.index + dir + len) % len;
    S.current.index = next;
    setIndex(next);
    segIdxRef.current = 0;
    startSegmentRef.current(0);
  };

  // (Re)start from the first phrase whenever a new queue (a fresh "Play"
  // click) arrives. An empty queue means idle — no listeners, no audio.
  useEffect(() => {
    if (queue.length === 0) return;
    const a = getAudio();
    const onEnded = () => startSegmentRef.current(segIdxRef.current + 1);
    // Treat a load/decode failure like the segment ending so playback never
    // stalls on a missing recording.
    const onError = () => window.setTimeout(() => startSegmentRef.current(segIdxRef.current + 1), 150);
    // Mirror the element's *actual* play/pause state back into React state.
    // Safari doesn't reliably call our mediaSession 'pause' action handler
    // for the hardware Pause key — it can pause the element directly. If we
    // only ever set `playing` from our own handlers, it goes stale (still
    // true) while the element is really paused, and the next Play press is
    // a no-op (state already true, so the resume effect never re-fires).
    // Listening to the element directly keeps `playing` truthful regardless
    // of how the pause happened.
    const onNativePlay = () => setPlaying(true);
    // Every browser fires 'pause' immediately before 'ended' when a
    // non-looping clip finishes naturally (a.ended is already true by the
    // time this listener runs) — that's the engine advancing to the next
    // segment, not a real user/OS pause. Treating it as one froze the queue
    // after the first phrase: `playing` flipped false, the pause/resume
    // effect called a.pause() on the segment we'd just started, and the gap
    // timer (gated on `playing`) never scheduled again.
    const onNativePause = () => {
      if (a.ended) return;
      setPlaying(false);
    };
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    a.addEventListener('play', onNativePlay);
    a.addEventListener('pause', onNativePause);

    segIdxRef.current = 0;
    S.current.index = 0;
    setIndex(0);
    S.current.playing = true;
    setPlaying(true);
    startSegmentRef.current(0);

    return () => {
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
      a.removeEventListener('play', onNativePlay);
      a.removeEventListener('pause', onNativePause);
      a.pause();
      clearTimer();
      lastTsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  // Switching mode mid-playback restarts the current phrase's sequence
  // under the new mode without touching queue position. Skips its own
  // mount-time run since the queue effect above already starts playback.
  const skipFirstModeRun = useRef(true);
  useEffect(() => {
    if (skipFirstModeRun.current) {
      skipFirstModeRun.current = false;
      return;
    }
    if (queue.length === 0) return;
    segIdxRef.current = 0;
    gapElapsedRef.current = 0;
    lastTsRef.current = null;
    startSegmentRef.current(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Pause/resume: stop or restart the clock and the underlying audio element.
  // Gaps play a silent loop (see startSegmentRef), so resuming always means
  // resuming whatever is currently loaded — real clip or silence alike.
  useEffect(() => {
    const a = audioRef.current;
    if (playing) {
      lastTsRef.current = null;
      if (a) playAudio(a, () => setPlaying(false));
      scheduleTick();
    } else {
      a?.pause();
      clearTimer();
      lastTsRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Apply volume changes live to whichever clip (or silent gap loop) is
  // currently loaded, without interrupting playback.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Release the generated silent-loop blob URL when the engine unmounts.
  useEffect(() => {
    return () => {
      if (silentUrlRef.current) URL.revokeObjectURL(silentUrlRef.current);
    };
  }, []);

  const currentPhrase = queue[index];

  // OS-level media keys (keyboard media buttons, headset controls) and the
  // Windows/macOS media overlay, via the Media Session API. Handlers are
  // registered once and read the engine through refs, so they always act on
  // whatever is current without re-subscribing.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => setPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', () => advanceRef.current(-1));
    navigator.mediaSession.setActionHandler('nexttrack', () => advanceRef.current(1));
    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, []);

  // Keep the OS media overlay's now-playing info and play/pause state in
  // sync with the current phrase. Cleared (metadata null) once the queue
  // empties so a stopped queue doesn't leave a stale entry behind.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!currentPhrase) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      return;
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentPhrase.text,
      artist: currentPhrase.translation || currentPhrase.languageName,
      album: 'Phrasebook',
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
  }, [currentPhrase, playing]);

  // In-page shortcuts (Space to play/pause, arrows to skip) while a queue is
  // active and focus isn't in a text field/select — registered once; the
  // no-op-when-idle check happens inside the handler via queueRef.
  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (queueRef.current.length === 0 || isTypingTarget(e.target)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(p => !p);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        advanceRef.current(1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        advanceRef.current(-1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return {
    phrase: currentPhrase,
    index,
    total: queue.length,
    playing,
    volume,
    setVolume,
    skipNext: () => advanceRef.current(1),
    skipPrev: () => advanceRef.current(-1),
    togglePlay: () => setPlaying(p => !p),
    bufferedCount,
    bufferTotal,
  };
}
