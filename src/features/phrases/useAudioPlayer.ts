import { useCallback, useEffect, useState } from 'react';

export function useAudioPlayer() {
  const [audio] = useState(() => new Audio());
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  useEffect(() => {
    const onEnded = () => setPlayingKey(null);
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [audio]);

  const play = useCallback((key: string, url: string) => {
    if (playingKey === key) {
      audio.pause();
      setPlayingKey(null);
      return;
    }
    audio.src = url;
    setCurrentUrl(url);
    audio.play().catch(() => setPlayingKey(null));
    setPlayingKey(key);
  }, [audio, playingKey]);

  const togglePause = useCallback(() => {
    if (audio.paused) audio.play();
    else audio.pause();
  }, [audio]);

  return { audio, playingKey, currentUrl, play, togglePause };
}
