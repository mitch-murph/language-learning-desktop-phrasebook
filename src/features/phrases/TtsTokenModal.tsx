import { useState } from 'react';
import { normalizeTtsUrl, setTtsUrl, TTS_DEMO_URL } from '../../api/tts';

interface Props {
  /** Why the previous attempt failed, shown when the dialog reopens. */
  notice?: string;
  onClose: () => void;
  onSaved: () => void;
}

const STEPS = [
  <>On the Google page, scroll to the <strong>Text-to-Speech</strong> demo and open the network tab (<strong>F12 → Network</strong>; use Firefox if Chrome blocks dev tools there).</>,
  <>Press <strong>Speak it</strong>, then find the request whose name contains <code>/proxy?</code>.</>,
  <>Copy its full <strong>Request URL</strong> (it contains <code>token=…</code>) and paste it below.</>,
];

export default function TtsTokenModal({ notice, onClose, onSaved }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function save() {
    const url = normalizeTtsUrl(value);
    if (!url) {
      setError('Could not find a token in that. Paste the full Request URL (it contains token=…).');
      return;
    }
    setTtsUrl(url);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="TTS token needed"
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
        onMouseDown={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-800">TTS token needed</h2>
        <p className="mt-1 text-sm text-slate-600">
          Audio generation uses a short-lived Google proxy token that is missing or has expired.
        </p>
        {notice && (
          <p className="mt-2 break-words rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            That token didn’t work: {notice}
          </p>
        )}
        <a
          href={TTS_DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Open Google TTS page ↗
        </a>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          {STEPS.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <input
          autoFocus
          value={value}
          onChange={e => {
            setValue(e.target.value);
            setError('');
          }}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="https://cxl-services.appspot.com/proxy?…&token=…"
          spellCheck={false}
          className="mt-3 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        {error && <p className="mt-2 break-words text-xs text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!value.trim()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
