import { useEffect, useRef, useState } from 'react';
import type { Phrase } from '../../api/client';
import { TtsError } from '../../api/tts';
import type { Language } from '../../domain/languages';
import { generateAndSave } from './generate';
import { useTtsGate } from './useTtsGate';

const NEW = '__new__';
const LANG_KEY = 'phrasebook.quickAddLanguage';
const FALLBACK_CODE = 'en-US';

interface Props {
  open: boolean;
  onClose: () => void;
  languages: Language[];
  allTags: string[];
  onAdded: (phrase: Phrase) => void;
}

const input =
  'min-w-0 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 disabled:bg-slate-100 disabled:text-slate-300';

function remembered(): string {
  try {
    return localStorage.getItem(LANG_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Inline add-phrase row, shown above the table while the toolbar's Add phrase
 * button is on. Kept mounted (just hidden) so a half-typed draft survives
 * closing.
 */
export default function QuickAddRow({ open, onClose, languages, allTags, onAdded }: Props) {
  const [langName, setLangName] = useState(remembered);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newNonLatin, setNewNonLatin] = useState(false);
  const [text, setText] = useState('');
  const [transcription, setTranscription] = useState('');
  const [translation, setTranslation] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [canFallback, setCanFallback] = useState(false);
  const [justAdded, setJustAdded] = useState('');
  const phraseRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (open) phraseRef.current?.focus();
  }, [open]);

  const selectedName =
    langName === NEW || languages.some(l => l.name === langName) ? langName : (languages[0]?.name ?? NEW);
  const creatingLanguage = selectedName === NEW;
  const existing = languages.find(l => l.name === selectedName);
  const lang: Language | null = creatingLanguage
    ? newName.trim() && newCode.trim()
      ? { name: newName.trim(), code: newCode.trim(), nonLatin: newNonLatin || !!transcription.trim() }
      : null
    : (existing ?? null);

  const gate = useTtsGate(e => {
    setError(e instanceof Error ? e.message : String(e));
    setCanFallback(e instanceof TtsError && e.unsupportedLanguage);
  });

  async function submit(ttsCode?: string) {
    const trimmed = text.trim();
    // Ref, not `busy` state: a second click/Enter can land before the re-render.
    if (!trimmed || !lang || busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setCanFallback(false);
    setJustAdded('');
    await gate.run(async () => {
      const phrase = await generateAndSave(
        {
          text: trimmed,
          languageCode: lang.code,
          languageName: lang.name,
          nonLatin: lang.nonLatin,
          transcription: lang.nonLatin ? transcription : undefined,
          translation,
          tags: tagsText.split(',').map(t => t.trim()).filter(Boolean),
        },
        ttsCode,
      );
      try {
        localStorage.setItem(LANG_KEY, lang.name);
      } catch {
        /* per-viewer convenience only */
      }
      setLangName(lang.name);
      setText('');
      setTranscription('');
      setTranslation('');
      setJustAdded(phrase.text);
      onAdded(phrase);
      phraseRef.current?.focus();
    });
    inFlight.current = false;
    setBusy(false);
  }

  return (
    <>
      <form
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
        onKeyDown={e => e.key === 'Escape' && onClose()}
        className={`mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 ${open ? '' : 'hidden'}`}
        aria-label="Add phrase"
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedName}
            onChange={e => setLangName(e.target.value)}
            className={`${input} max-sm:basis-full`}
            aria-label="Language"
          >
            {languages.map(l => (
              <option key={l.name} value={l.name}>
                {l.name}
              </option>
            ))}
            <option value={NEW}>New language…</option>
          </select>
          {creatingLanguage && (
            <>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Name (Japanese)"
                className={`${input} w-36`}
              />
              <input
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                placeholder="Code (ja-JP)"
                className={`${input} w-28`}
              />
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={newNonLatin} onChange={e => setNewNonLatin(e.target.checked)} />
                Non-Latin
              </label>
            </>
          )}
          <input
            ref={phraseRef}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Phrase"
            className={`${input} min-w-[180px] flex-[2]`}
            aria-label="Phrase"
          />
          <input
            value={transcription}
            onChange={e => setTranscription(e.target.value)}
            placeholder="Romanization"
            disabled={!creatingLanguage && !lang?.nonLatin}
            className={`${input} min-w-[120px] flex-1`}
            aria-label="Romanization"
          />
          <input
            value={translation}
            onChange={e => setTranslation(e.target.value)}
            placeholder="Translation"
            className={`${input} min-w-[140px] flex-[2]`}
            aria-label="Translation"
          />
          <input
            value={tagsText}
            onChange={e => setTagsText(e.target.value)}
            placeholder="Tags, comma separated"
            list="quick-add-tags"
            className={`${input} min-w-[120px] flex-1`}
            aria-label="Tags"
          />
          <datalist id="quick-add-tags">
            {allTags.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            type="submit"
            disabled={busy || !text.trim() || !lang}
            className="min-w-[110px] whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Generating…' : 'Add phrase'}
          </button>
          <button
            type="button"
            onClick={gate.openTokenModal}
            className="whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-amber-100"
          >
            TTS token
          </button>
        </div>
        {(error || justAdded) && (
          <p className={`mt-2 break-words text-xs ${error ? 'text-red-700' : 'text-emerald-600'}`} aria-live="polite">
            {error || `Added “${justAdded}”`}
            {canFallback && (
              <button
                type="button"
                onClick={() => void submit(FALLBACK_CODE)}
                className="ml-2 rounded bg-white px-2 py-0.5 font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
              >
                Retry using {FALLBACK_CODE}
              </button>
            )}
          </p>
        )}
      </form>
      {gate.tokenModal}
    </>
  );
}
