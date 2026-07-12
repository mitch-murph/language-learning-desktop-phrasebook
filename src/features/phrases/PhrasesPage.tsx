import { useMemo, useState } from 'react';
import { getAudioUrl, type Phrase } from '../../api/client';
import { usePhrases } from './usePhrases';
import { useAudioPlayer } from './useAudioPlayer';
import { useQueuePlayer, type QueueMode } from './useQueuePlayer';
import { buildColumns, type StudyColumn } from './columns';
import PhraseTable from './PhraseTable';
import Toolbar from './Toolbar';
import StudyBar from './StudyBar';
import ExportModal from './ExportModal';
import QueuePlayerBar from './QueuePlayerBar';

const NO_HIDDEN: Record<StudyColumn, boolean> = { text: false, transcription: false, translation: false };

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PhrasesPage() {
  const { phrases, loading, error, patch, remove } = usePhrases();
  const { playingKey, play, stop: stopRowAudio } = useAudioPlayer();

  const [search, setSearch] = useState('');
  const [language, setLanguage] = useState('');
  const [tag, setTag] = useState('');

  const [editMode, setEditMode] = useState(false);
  const [hidden, setHidden] = useState<Record<StudyColumn, boolean>>(NO_HIDDEN);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);

  const [playMode, setPlayMode] = useState<QueueMode>('normal');
  const [shuffleQueue, setShuffleQueue] = useState(false);
  const [queue, setQueue] = useState<Phrase[]>([]);
  const queuePlayer = useQueuePlayer(queue, playMode);

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

  function toggleSelect(phraseId: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(phraseId)) next.delete(phraseId);
      else next.add(phraseId);
      return next;
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every(p => selected.has(p.phraseId));

  function toggleSelectAllVisible() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach(p => next.delete(p.phraseId));
      else filtered.forEach(p => next.add(p.phraseId));
      return next;
    });
  }

  const anyHidden = hidden.text || hidden.transcription || hidden.translation;

  // Manually selected phrases take priority (persists across filter changes,
  // so selections can be built up across different filter views); otherwise
  // export/play operate on whatever the current search/language/tag filters show.
  const exportTargets = selected.size > 0 ? phrases.filter(p => selected.has(p.phraseId)) : filtered;

  // A row's own Normal/Slow button and the background queue share one audio
  // stream conceptually — starting either one stops the other.
  function onCellPlay(phraseId: string, pace: 'normal' | 'slow', s3Key: string) {
    if (queue.length > 0) setQueue([]);
    play(`${phraseId}:${pace}`, getAudioUrl(s3Key));
  }

  function startQueue() {
    const list = shuffleQueue ? shuffled(exportTargets) : exportTargets;
    if (list.length === 0) return;
    stopRowAudio();
    setQueue(list);
  }

  const columns = useMemo(
    () =>
      buildColumns({
        playingKey,
        onPlay: onCellPlay,
        onPatch: patch,
        onDelete: remove,
        allTags: tags,
        editMode,
        hidden,
        isRevealed,
        onReveal,
        selected,
        onToggleSelect: toggleSelect,
        allVisibleSelected,
        onToggleSelectAllVisible: toggleSelectAllVisible,
      }),
    [playingKey, patch, remove, tags, editMode, hidden, revealed, selected, allVisibleSelected, filtered],
  );

  if (loading) return <p className="text-sm text-slate-500">Loading phrases…</p>;

  return (
    <div className={queue.length > 0 ? 'pb-16' : undefined}>
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
        selectedCount={selected.size}
        onClearSelection={() => setSelected(new Set())}
        onExport={() => setShowExport(true)}
        playMode={playMode}
        onPlayModeChange={setPlayMode}
        shuffle={shuffleQueue}
        onShuffleChange={setShuffleQueue}
        onPlay={startQueue}
      />
      <PhraseTable data={filtered} columns={columns} playingRowId={queue.length > 0 ? queuePlayer.phrase?.phraseId : null} />
      {showExport && <ExportModal phrases={exportTargets} onClose={() => setShowExport(false)} />}
      {queue.length > 0 && (
        <QueuePlayerBar
          phrase={queuePlayer.phrase}
          index={queuePlayer.index}
          total={queuePlayer.total}
          playing={queuePlayer.playing}
          mode={playMode}
          onSetMode={setPlayMode}
          onTogglePlay={queuePlayer.togglePlay}
          onSkipNext={queuePlayer.skipNext}
          onSkipPrev={queuePlayer.skipPrev}
          onStop={() => setQueue([])}
        />
      )}
    </div>
  );
}
