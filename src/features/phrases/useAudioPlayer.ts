import { useCallback, useEffect, useState } from 'react';

export function useAudioPlayer() {
  const [audio] = useState(() => new Audio());
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => setPlayingKey(null);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [audio]);

  const play = useCallback((key: string, url: string) => {
    if (playingKey === key) {
      audio.pause();
      setPlayingKey(null);
      return;
    }
    audio.src = url;
    setCurrentUrl(url);
    setCurrentTime(0);
    setDuration(0);
    audio.play().catch(() => setPlayingKey(null));
    setPlayingKey(key);
  }, [audio, playingKey]);

  const togglePause = useCallback(() => {
    if (audio.paused) audio.play();
    else audio.pause();
  }, [audio]);

  const seek = useCallback((fraction: number) => {
    if (!duration) return;
    audio.currentTime = Math.min(duration, Math.max(0, fraction * duration));
  }, [audio, duration]);

  return { playingKey, currentUrl, currentTime, duration, isPlaying, play, togglePause, seek };
}
