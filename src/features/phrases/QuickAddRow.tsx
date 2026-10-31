import { useEffect, useRef, useState } from 'react';
import type { Phrase } from '../../api/client';
import { callTts, TRANSLATION_PROMPT, TtsError } from '../../api/tts';
import type { Language } from '../../domain/languages';
import { KeyIcon } from './icons';
import { generateAndSave } from './generate';
import { useTtsGate } from './useTtsGate';

const NEW = '__new__';
const LANG_KEY = 'phrasebook.quickAddLanguage';
const FALLBACK_CODE = 'en-US';

type ClipKind = 'normal' | 'slow' | 'translation';

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
  const [listening, setListening] = useState<ClipKind | null>(null);
  const [listenLoading, setListenLoading] = useState<ClipKind | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Clips synthesized by Listen, keyed by kind + text + voice; Add reuses matches.
  const clips = useRef(new Map<string, string>());
  const lastAction = useRef<{ kind: 'add' } | { kind: 'listen'; clip: ClipKind }>({ kind: 'add' });

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

  function stopListening() {
    audioRef.current?.pause();
    audioRef.current = null;
    setListening(null);
  }

  useEffect(() => stopListening, []);

  /** What to synthesize for a clip kind; null when there is nothing to say. */
  function clipSpec(kind: ClipKind, voiceCode: string) {
    const trimmed = text.trim();
    const tr = translation.trim();
    if (!lang) return null;
    if (kind === 'translation') {
      return tr ? { key: `translation|${tr}`, say: () => callTts(tr, 'en-US', 'normal', '', TRANSLATION_PROMPT) } : null;
    }
    return trimmed
      ? { key: `${kind}|${voiceCode}|${lang.name}|${trimmed}`, say: () => callTts(trimmed, voiceCode, kind, lang.name) }
      : null;
  }

  async function listen(kind: ClipKind, ttsCode?: string) {
    const spec = clipSpec(kind, ttsCode ?? lang?.code ?? '');
    if (!spec || busy || inFlight.current) return;
    const wasPlaying = listening === kind;
    stopListening();
    if (wasPlaying) return;
    inFlight.current = true;
    setBusy(true);
    setListenLoading(kind);
    setError('');
    setCanFallback(false);
    setJustAdded('');
    lastAction.current = { kind: 'listen', clip: kind };
    await gate.run(async () => {
      let base64 = clips.current.get(spec.key);
      if (!base64) {
        base64 = await spec.say();
        clips.current.set(spec.key, base64);
      }
      const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
      audio.onended = () => {
        if (audioRef.current === audio) stopListening();
      };
      audioRef.current = audio;
      setListening(kind);
      await audio.play();
    });
    inFlight.current = false;
    setListenLoading(null);
    setBusy(false);
  }

  async function submit(ttsCode?: string) {
    const trimmed = text.trim();
    // Ref, not `busy` state: a second click/Enter can land before the re-render.
    if (!trimmed || !lang || busy || inFlight.current) return;
    stopListening();
    inFlight.current = true;
    setBusy(true);
    setError('');
    setCanFallback(false);
    setJustAdded('');
    lastAction.current = { kind: 'add' };
    const code = ttsCode ?? lang.code;
    const prefetched = {
      normal: clips.current.get(clipSpec('normal', code)?.key ?? ''),
      slow: clips.current.get(clipSpec('slow', code)?.key ?? ''),
      translation: clips.current.get(clipSpec('translation', code)?.key ?? ''),
    };
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
        prefetched,
      );
      clips.current.clear();
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

  /** Small in-field play control; fixed width so state changes never shift the field. */
  function listenButton(kind: ClipKind, label: string, title: string) {
    const active = listening === kind;
    return (
      <button
        type="button"
        onClick={() => void listen(kind)}
        disabled={(busy && !active) || !clipSpec(kind, lang?.code ?? '')}
        title={title}
        aria-label={title}
        className={`h-6 min-w-[28px] rounded px-1.5 text-xs font-medium tabular-nums hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30 ${active ? 'bg-blue-100 text-blue-700' : 'text-slate-600'}`}
      >
        {active ? '■' : listenLoading === kind ? '…' : label}
      </button>
    );
  }

  return (
    <>
      <form
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') onClose();
          else if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            void listen('normal');
          }
        }}
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
          <div className="relative min-w-[170px] flex-[2]">
            <input
              value={translation}
              onChange={e => setTranslation(e.target.value)}
              placeholder="Translation"
              className={`${input} w-full pr-9`}
              aria-label="Translation"
            />
            <div className="absolute inset-y-0 right-1 flex items-center">
              {listenButton('translation', '▶', 'Hear the translation without saving')}
            </div>
          </div>
          <div className="relative min-w-[200px] flex-[2]">
            <input
              ref={phraseRef}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Phrase"
              className={`${input} w-full pr-[84px]`}
              aria-label="Phrase"
            />
            <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
              {listenButton('normal', '▶', 'Hear the phrase at normal speed without saving (Ctrl+Enter)')}
              {listenButton('slow', 'slow', 'Hear the phrase slowly without saving')}
            </div>
          </div>
          <input
            value={transcription}
            onChange={e => setTranscription(e.target.value)}
            placeholder="Romanization"
            disabled={!creatingLanguage && !lang?.nonLatin}
            className={`${input} min-w-[120px] flex-1`}
            aria-label="Romanization"
          />
          <input
            value={tagsText}
            onChange={e => setTagsText(e.target.value)}
            placeholder="Tags, comma separated"
            list="quick-add-tags"
            className={`${input} min-w-[110px] flex-1`}
            aria-label="Tags"
          />
          <datalist id="quick-add-tags">
            {allTags.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button
            type="submit"
            title="Generate audio and save the phrase"
            disabled={busy || !text.trim() || !lang}
            className="min-w-[56px] whitespace-nowrap rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && lastAction.current.kind === 'add' ? '…' : 'Add'}
          </button>
          <button
            type="button"
            onClick={gate.openTokenModal}
            title="TTS token"
            aria-label="TTS token"
            className="rounded-md p-1.5 text-slate-500 hover:bg-amber-100"
          >
            <KeyIcon />
          </button>
        </div>
        {(error || justAdded) && (
          <p className={`mt-2 break-words text-xs ${error ? 'text-red-700' : 'text-emerald-600'}`} aria-live="polite">
            {error || `Added “${justAdded}”`}
            {canFallback && (
              <button
                type="button"
                onClick={() => void (lastAction.current.kind === 'listen'
                      ? listen(lastAction.current.clip, FALLBACK_CODE)
                      : submit(FALLBACK_CODE))}
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
