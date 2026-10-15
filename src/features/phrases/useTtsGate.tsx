import { useCallback, useRef, useState, type ReactNode } from 'react';
import { needsToken, TTS_DEMO_URL } from '../../api/tts';
import TtsTokenModal from './TtsTokenModal';

/**
 * Runs a TTS-dependent action. If the proxy token is missing/expired, opens
 * Google's demo page in a new tab plus a paste-in modal, then re-runs the
 * action with whatever token was entered. If that fails with a token problem
 * again, the modal simply reopens (showing why). Other errors go to `onError`.
 */
export function useTtsGate(onError: (e: unknown) => void): {
  run: (fn: () => Promise<void>) => Promise<void>;
  tokenModal: ReactNode;
  openTokenModal: () => void;
} {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const pending = useRef<(() => Promise<void>) | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const attempt = useCallback(async (fn: () => Promise<void>, isRetry: boolean) => {
    try {
      await fn();
    } catch (e) {
      if (needsToken(e)) {
        pending.current = fn;
        setNotice(isRetry && e instanceof Error ? e.message : '');
        setOpen(true);
        // First failure only: usually allowed (still within the click's
        // activation window); the modal has its own link if blocked.
        if (!isRetry) window.open(TTS_DEMO_URL, '_blank', 'noopener,noreferrer');
      } else {
        onErrorRef.current(e);
      }
    }
  }, []);

  const run = useCallback((fn: () => Promise<void>) => attempt(fn, false), [attempt]);

  const tokenModal = open ? (
    <TtsTokenModal
      notice={notice}
      onClose={() => {
        pending.current = null;
        setOpen(false);
      }}
      onSaved={() => {
        const fn = pending.current;
        pending.current = null;
        setOpen(false);
        if (fn) void attempt(fn, true);
      }}
    />
  ) : null;

  const openTokenModal = useCallback(() => {
    pending.current = null;
    setNotice('');
    setOpen(true);
  }, []);

  return { run, tokenModal, openTokenModal };
}
