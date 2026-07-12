import { useEffect, useRef, useState } from 'react';

const BAR_COUNT = 40;
const peaksCache = new Map<string, Promise<number[]>>();

async function decodePeaks(url: string): Promise<number[]> {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channel = audioBuffer.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(channel.length / BAR_COUNT));
    const peaks: number[] = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const start = i * blockSize;
      let sum = 0;
      for (let j = 0; j < blockSize; j++) sum += Math.abs(channel[start + j] ?? 0);
      peaks.push(sum / blockSize);
    }
    const max = Math.max(...peaks, 0.0001);
    return peaks.map(p => Math.max(0.08, p / max));
  } finally {
    ctx.close();
  }
}

function getPeaks(url: string): Promise<number[]> {
  let cached = peaksCache.get(url);
  if (!cached) {
    cached = decodePeaks(url).catch(() => new Array(BAR_COUNT).fill(0.3));
    peaksCache.set(url, cached);
  }
  return cached;
}

interface Props {
  url: string;
  progress: number;
  onSeek: (fraction: number) => void;
}

export default function Waveform({ url, progress, onSeek }: Props) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setPeaks(null);
    getPeaks(url).then(p => {
      if (!cancelled) setPeaks(p);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function seekFromEvent(e: React.PointerEvent) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(fraction);
  }

  const bars = peaks ?? new Array(BAR_COUNT).fill(0.15);
  const activeBars = Math.round(progress * bars.length);

  return (
    <div
      ref={containerRef}
      onPointerDown={e => {
        seekFromEvent(e);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        if (e.buttons === 1) seekFromEvent(e);
      }}
      className="flex h-6 flex-1 cursor-pointer items-center gap-px select-none"
    >
      {bars.map((p, i) => (
        <span
          key={i}
          className={`flex-1 rounded-sm ${i < activeBars ? 'bg-blue-600' : 'bg-slate-300'} ${
            peaks ? '' : 'animate-pulse'
          }`}
          style={{ height: `${p * 100}%` }}
        />
      ))}
    </div>
  );
}
