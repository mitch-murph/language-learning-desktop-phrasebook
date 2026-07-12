import { useMemo, useState } from 'react';
import { getAudioUrl } from '../../api/client';
import { usePhrases } from './usePhrases';
import { useAudioPlayer } from './useAudioPlayer';
import { buildColumns, type StudyColumn } from './columns';
import PhraseTable from './PhraseTable';
import Toolbar from './Toolbar';
import StudyBar from './StudyBar';

const NO_HIDDEN: Record<StudyColumn, boolean> = { text: false, transcription: false, translation: false };

export default function PhrasesPage() {
  const { phrases, loading, error, patch, remove } = usePhrases();
  const { playingKey, currentUrl, currentTime, duration, isPlaying, play, togglePause, seek } = useAudioPlayer();

  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [tag, setTag] = useState('');

  const [editMode, setEditMode] = useState(false);
  const [hidden, setHidden] = useState<Record<StudyColumn, boolean>>(NO_HIDDEN);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const languages = useMemo(
    () => [...new Set(phrases.map(p => p.languageName))].sort(),
    [phrases],
  );
  const tags = useMemo(
    () => [...new Set(phrases.flatMap(p => p.tags ?? []))].sort(),
    [phrases],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return phrases.filter(p => {
      if (language && p.languageName !== language) return false;
      if (tag && !(p.tags ?? []).includes(tag)) return false;
      if (q) {
        const haystack = `${p.text} ${p.transcription ?? ''} ${p.translation ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [phrases, search, language, tag]);

  function toggleHidden(col: StudyColumn) {
    setHidden(h => ({ ...h, [col]: !h[col] }));
  }

  function isRevealed(phraseId: string, col: StudyColumn) {
    return revealed.has(`${phraseId}:${col}`);
  }

  function onReveal(phraseId: string, col: StudyColumn) {
    setRevealed(prev => new Set(prev).add(`${phraseId}:${col}`));
  }

  const anyHidden = hidden.text || hidden.transcription || hidden.translation;

  const columns = useMemo(
    () =>
      buildColumns({
        playingKey,
        currentUrl,
        currentTime,
        duration,
        isPlaying,
        onPlay: (phraseId, pace, s3Key) => play(`${phraseId}:${pace}`, getAudioUrl(s3Key)),
        onSeek: seek,
        onTogglePause: togglePause,
        onPatch: patch,
        onDelete: remove,
        allTags: tags,
        editMode,
        hidden,
        isRevealed,
        onReveal,
      }),
    [playingKey, currentUrl, currentTime, duration, isPlaying, patch, remove, tags, editMode, hidden, revealed],
  );

  if (loading) return <p className="text-sm text-slate-500">Loading phrases…</p>;

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <StudyBar
        editMode={editMode}
        onToggleEditMode={() => setEditMode(v => !v)}
        hidden={hidden}
        onToggleHidden={toggleHidden}
        onResetReveals={() => setRevealed(new Set())}
        anyHidden={anyHidden}
      />
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        language={language}
        onLanguageChange={setLanguage}
        languages={languages}
        tag={tag}
        onTagChange={setTag}
        tags={tags}
        count={filtered.length}
      />
      <PhraseTable data={filtered} columns={columns} />
    </div>
  );
}
