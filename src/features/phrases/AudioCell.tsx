import { useEffect, useState } from 'react';
import PlayButton from './PlayButton';
import Waveform from './Waveform';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
  audio: HTMLAudioElement;
  url: string;
  label: string;
  onTogglePause: () => void;
  onClose: () => void;
}

// Ticks on every timeupdate event (many times per second) while playing.
// Kept as its own leaf component so that frequent updates re-render only
// this cell, not the whole table.
export default function AudioCell({ audio, url, label, onTogglePause, onClose }: Props) {
  const [currentTime, setCurrentTime] = useState(audio.currentTime);
  const [duration, setDuration] = useState(audio.duration || 0);
  const [isPlaying, setIsPlaying] = useState(!audio.paused);

  useEffect(() => {
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration || 0);
    setIsPlaying(!audio.paused);

    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [audio, url]);

  function seek(fraction: number) {
    if (!duration) return;
    audio.currentTime = Math.min(duration, Math.max(0, fraction * duration));
  }

  return (
    <div className="flex items-center gap-1.5">
      <PlayButton label={label} active={isPlaying} onClick={onTogglePause} />
      <Waveform url={url} progress={duration > 0 ? currentTime / duration : 0} onSeek={seek} />
      <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-slate-400">
        {formatTime(currentTime)}/{formatTime(duration)}
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close player"
        className="shrink-0 rounded px-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        ✕
      </button>
    </div>
  );
}
