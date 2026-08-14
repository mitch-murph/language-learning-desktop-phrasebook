import { useState } from 'react';
import type { Phrase } from '../../api/client';
import { downloadCombined, downloadZip, type ExportMode, type ExportResult, type ExportStage } from './exportUtils';

const MODE_INFO: Record<ExportMode, { label: string; description: string }> = {
  normal: { label: 'Normal', description: 'One file per phrase at normal speed.' },
  slow: { label: 'Slow', description: 'One file per phrase at slow "teacher" speed.' },
  fast: {
    label: 'Fast',
    description: 'Same audio as Normal — only affects Combined export, which uses a much shorter gap between phrases.',
  },
  drill: { label: 'Drill', description: 'Normal, then slow, then normal again per phrase, with pauses between.' },
  fastDrill: {
    label: 'Fast Drill',
    description: 'Normal, then slow, then normal again, with much shorter pauses than Drill.',
  },
  recall: {
    label: 'Recall',
    description:
      'Translation first, a pause to try to recall it, then the phrase as the reveal. Phrases with no saved translation audio are skipped.',
  },
  recallDrill: {
    label: 'Recall Drill',
    description:
      'Translation lead-in with a long pause, then a full Drill rep (normal, slow, normal). Phrases with no saved translation audio are skipped.',
  },
  reverseRecall: {
    label: 'Reverse Recall',
    description:
      'The mirror of Recall — normal speed first, a pause, then the translation as the reveal. Phrases with no saved translation audio are skipped.',
  },
};

const ALBUM_STORAGE_KEY = 'phrasebook:exportAlbum';

// Keyed per-language (or "mixed") so each language remembers its own last-used
// album name instead of one export's edit clobbering the default for every language.
function albumDefaults(phrases: Phrase[]): { storageKey: string; name: string } {
  const languages = [...new Set(phrases.map(p => p.languageName))];
  if (languages.length === 1) {
    return { storageKey: `${ALBUM_STORAGE_KEY}:${languages[0]}`, name: `Phrasebook - ${languages[0]}` };
  }
  return { storageKey: `${ALBUM_STORAGE_KEY}:mixed`, name: 'Phrasebook' };
}

interface Props {
  phrases: Phrase[];
  onClose: () => void;
}

export default function ExportModal({ phrases, onClose }: Props) {
  const { storageKey: albumStorageKey, name: defaultAlbum } = albumDefaults(phrases);
  const [mode, setMode] = useState<ExportMode>('normal');
  const [album, setAlbum] = useState(() => localStorage.getItem(albumStorageKey) ?? defaultAlbum);
  const [progress, setProgress] = useState<{ done: number; total: number; stage: ExportStage } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ phrase: Phrase; reason: string }[]>([]);
  const busy = progress !== null;

  function updateAlbum(value: string) {
    setAlbum(value);
    localStorage.setItem(albumStorageKey, value);
  }

  async function run(exporter: (onProgress: (done: number, total: number, stage: ExportStage) => void) => Promise<ExportResult>) {
    setError(null);
    setSkipped([]);
    setProgress({ done: 0, total: phrases.length, stage: 'fetch' });
    try {
      const result = await exporter((done, total, stage) => setProgress({ done, total, stage }));
      setSkipped(result.skipped);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setProgress(null);
    }
  }

  const runZip = () => run(onProgress => downloadZip(phrases, mode, album.trim() || defaultAlbum, onProgress));
  const runCombined = () => run(onProgress => downloadCombined(phrases, mode, album.trim() || defaultAlbum, onProgress));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-3 text-base font-semibold text-slate-800">
          Export {phrases.length} phrase{phrases.length !== 1 ? 's' : ''}
        </h2>

        <label className="mb-3 block text-xs font-medium text-slate-600">
          Album tag
          <input
            type="text"
            value={album}
            onChange={e => updateAlbum(e.target.value)}
            disabled={busy}
            placeholder={defaultAlbum}
            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800 disabled:opacity-50"
          />
          <span className="mt-1 block font-normal text-slate-400">
            Written into every exported file's ID3 album tag. Keep this the same across exports so your music app
            recognizes re-synced phrases instead of duplicating them.
          </span>
        </label>

        <div className="mb-3 grid grid-cols-2 gap-2">
          {(Object.keys(MODE_INFO) as ExportMode[]).map(m => (
            <label
              key={m}
              className={`cursor-pointer rounded-md border px-3 py-2 text-center text-sm font-medium ${
                mode === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="export-mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                disabled={busy}
                className="sr-only"
              />
              {MODE_INFO[m].label}
            </label>
          ))}
        </div>
        <p className="mb-1 text-xs text-slate-500">{MODE_INFO[mode].description}</p>
        <p className="mb-4 text-xs text-slate-400">
          Combined joins every phrase into one MP3 with a gap between phrases (shorter for Fast/Fast Drill); ZIP gives
          one MP3 file per phrase.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={runZip}
            disabled={busy || phrases.length === 0}
            className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Exporting…' : 'Download ZIP'}
          </button>
          <button
            type="button"
            onClick={runCombined}
            disabled={busy || phrases.length === 0}
            className="flex-1 rounded-md border border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {busy ? 'Exporting…' : 'Combined MP3'}
          </button>
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {progress && (
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${progress.stage === 'encode' ? 100 : (progress.done / progress.total) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-center text-xs text-slate-400">
              {progress.stage === 'encode' ? 'Encoding MP3…' : `${progress.done} / ${progress.total}`}
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        {skipped.length > 0 && (
          <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
            <p className="mb-1 font-medium">
              {skipped.length} phrase{skipped.length !== 1 ? 's' : ''} skipped:
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {skipped.slice(0, 5).map(s => (
                <li key={s.phrase.phraseId} className="truncate">
                  {s.phrase.text} — {s.reason}
                </li>
              ))}
              {skipped.length > 5 && <li>…and {skipped.length - 5} more</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
