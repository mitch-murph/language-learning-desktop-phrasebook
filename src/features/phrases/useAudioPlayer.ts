import { useCallback, useRef, useState } from 'react';

export function useAudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const play = useCallback((key: string, url: string) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;

    if (playingKey === key) {
      audio.pause();
      setPlayingKey(null);
      return;
    }

    audio.src = url;
    audio.onended = () => setPlayingKey(null);
    audio.play().catch(() => setPlayingKey(null));
    setPlayingKey(key);
  }, [playingKey]);

  return { playingKey, play };
}
