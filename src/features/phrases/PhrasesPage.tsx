import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import type { VisibilityState } from '@tanstack/react-table';
import { getAudioUrl, type Phrase } from '../../api/client';
import { usePhrases } from './usePhrases';
import { useAudioPlayer } from './useAudioPlayer';
import { useQueuePlayer, type QueueMode } from './useQueuePlayer';
import { buildColumns, type StudyColumn } from './columns';
import PhraseTable from './PhraseTable';
import Toolbar from './Toolbar';
import ExportModal from './ExportModal';
import QueuePlayerBar from './QueuePlayerBar';
import QuickAddRow from './QuickAddRow';
import { generateAndSave, refreshAudioCache } from './generate';
import { useTtsGate } from './useTtsGate';
import { languagesFromPhrases } from '../../domain/languages';

const NO_HIDDEN: Record<StudyColumn, boolean> = { text: false, transcription: false, translation: false };

const COLUMN_VISIBILITY_KEY = 'phrasebook.columnVisibility';

function loadColumnVisibility(): VisibilityState {
  try {
    const raw = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PhrasesPage() {
  const { phrases, loading, error, patch, remove, add, replace, reportError } = usePhrases();
  const { playingKey, play, stop: stopRowAudio } = useAudioPlayer();

  const [search, setSearch] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(true);
  const [columnVisibility, setColumnVisibilityState] = useState<VisibilityState>(loadColumnVisibility);

  function setColumnVisibility(v: VisibilityState) {
    setColumnVisibilityState(v);
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(v));
  }

  const [editMode, setEditMode] = useState(false);
  const [hidden, setHidden] = useState<Record<StudyColumn, boolean>>(NO_HIDDEN);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [playMode, setPlayMode] = useState<QueueMode>('recallDrill');
  const [shuffleQueue, setShuffleQueue] = useState(true);
  const [queue, setQueue] = useState<Phrase[]>([]);
  const queuePlayer = useQueuePlayer(queue, playMode);

  const languageObjects = useMemo(() => languagesFromPhrases(phrases), [phrases]);

  const gate = useTtsGate(e => reportError(e instanceof Error ? e.message : String(e)));

  // Text and audio are immutable server-side, so "regenerate" (same text or an
  // edited one) saves a fresh record and then deletes the old one. Rows are
  // memoized, so this only touches functional setState and stable callbacks.
  const regenerate = useCallback(
    (p: Phrase, text: string) => {
      setRegenerating(s => new Set(s).add(p.phraseId));
      void gate
        .run(async () => {
          const fresh = await generateAndSave({
            text,
            languageCode: p.languageCode,
            languageName: p.languageName,
            nonLatin: p.nonLatin,
            transcription: p.transcription,
            translation: p.translation,
            tags: p.tags,
            hide: p.hide,
          });
          await refreshAudioCache(fresh);
          setSelected(prev => {
            if (!prev.has(p.phraseId)) return prev;
            const n = new Set(prev);
            n.delete(p.phraseId);
            n.add(fresh.phraseId);
            return n;
          });
          await replace(p.phraseId, fresh);
        })
        .finally(() =>
          setRegenerating(s => {
            const n = new Set(s);
            n.delete(p.phraseId);
            return n;
          }),
        );
    },
    [gate.run, replace],
  );

  const languages = useMemo(
    () => [...new Set(phrases.map(p => p.languageName))].sort(),
    [phrases],
  );
  const tags = useMemo(
    () => [...new Set(phrases.flatMap(p => p.tags ?? []))].sort(),
    [phrases],
  );

  // Toolbar tag filter only offers tags that exist in the selected languages
  // (all tags when none selected). Already-selected tags stay listed so they
  // remain visible/clearable after switching languages. The editor's
  // suggestions keep using the global `tags` list.
  const tagFilterOptions = useMemo(() => {
    if (selectedLanguages.length === 0) return tags;
    const inScope = phrases
      .filter(p => selectedLanguages.includes(p.languageName))
      .flatMap(p => p.tags ?? []);
    return [...new Set([...inScope, ...selectedTags])].sort();
  }, [phrases, tags, selectedLanguages, selectedTags]);

  // Keystrokes update the input immediately; the (expensive) refilter and table
  // re-render run at lower priority so typing stays responsive.
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return phrases.filter(p => {
      if (!showHidden && (p.hide ?? false)) return false;
      if (selectedLanguages.length > 0 && !selectedLanguages.includes(p.languageName)) return false;
      if (selectedTags.length > 0 && !(p.tags ?? []).some(t => selectedTags.includes(t))) return false;
      if (q) {
        const haystack = `${p.text} ${p.transcription ?? ''} ${p.translation ?? ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [phrases, deferredSearch, selectedLanguages, selectedTags, showHidden]);

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
  // Functional setQueue (not a `queue.length` read) because memoized rows may
  // hold a stale copy of this callback.
  function onCellPlay(phraseId: string, pace: 'normal' | 'slow', s3Key: string) {
    setQueue(q => (q.length > 0 ? [] : q));
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
        onRegenerate: regenerate,
        regenerating,
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
    [playingKey, patch, remove, regenerate, regenerating, tags, editMode, hidden, revealed, selected, allVisibleSelected, filtered],
  );

  // Signatures PhraseTable/PhraseCards use to decide which rows must re-render.
  // Anything the column cell closures read must be reflected in one of these.
  const globalSignature = `${editMode ? 1 : 0}|${hidden.text ? 1 : 0}${hidden.transcription ? 1 : 0}${
    hidden.translation ? 1 : 0
  }|${tags.join('\u0001')}`;
  const rowSignature = useCallback(
    (id: string) => {
      const pace = playingKey === `${id}:normal` ? 'n' : playingKey === `${id}:slow` ? 's' : '-';
      return `${selected.has(id) ? 1 : 0}${regenerating.has(id) ? 1 : 0}${pace}${revealed.has(`${id}:text`) ? 1 : 0}${
        revealed.has(`${id}:transcription`) ? 1 : 0
      }${revealed.has(`${id}:translation`) ? 1 : 0}`;
    },
    [selected, playingKey, revealed, regenerating],
  );

  if (loading) return <p className="text-sm text-slate-500">Loading phrases…</p>;

  return (
    <div className={queue.length > 0 ? 'pb-44 sm:pb-36' : undefined}>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        selectedLanguages={selectedLanguages}
        onLanguagesChange={setSelectedLanguages}
        languageOptions={languages}
        selectedTags={selectedTags}
        onTagsChange={setSelectedTags}
        tagOptions={tagFilterOptions}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
        count={filtered.length}
        selectedCount={selected.size}
        onClearSelection={() => setSelected(new Set())}
        onExport={() => setShowExport(true)}
        addOpen={showAdd}
        onToggleAdd={() => setShowAdd(v => !v)}
        playMode={playMode}
        onPlayModeChange={setPlayMode}
        shuffle={shuffleQueue}
        onShuffleChange={setShuffleQueue}
        onPlay={startQueue}
        editMode={editMode}
        onToggleEditMode={() => setEditMode(v => !v)}
        studyHidden={hidden}
        onToggleStudyHidden={toggleHidden}
        onResetReveals={() => setRevealed(new Set())}
        anyStudyHidden={anyHidden}
      />
      <QuickAddRow
        open={showAdd}
        onClose={() => setShowAdd(false)}
        languages={languageObjects}
        allTags={tags}
        onAdded={add}
      />
      {gate.tokenModal}
      <PhraseTable
        data={filtered}
        columns={columns}
        playingRowId={queue.length > 0 ? queuePlayer.phrase?.phraseId : null}
        editMode={editMode}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        globalSignature={globalSignature}
        rowSignature={rowSignature}
        studyHidden={hidden}
        onToggleStudyHidden={toggleHidden}
        onToggleEditMode={() => setEditMode(v => !v)}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
      />
      {showExport && <ExportModal phrases={exportTargets} onClose={() => setShowExport(false)} />}
      {queue.length > 0 && (
        <QueuePlayerBar
          phrase={queuePlayer.phrase}
          index={queuePlayer.index}
          total={queuePlayer.total}
          playing={queuePlayer.playing}
          mode={playMode}
          volume={queuePlayer.volume}
          bufferedCount={queuePlayer.bufferedCount}
          bufferTotal={queuePlayer.bufferTotal}
          onSetMode={setPlayMode}
          onTogglePlay={queuePlayer.togglePlay}
          onSkipNext={queuePlayer.skipNext}
          onSkipPrev={queuePlayer.skipPrev}
          onStop={() => setQueue([])}
          onVolumeChange={queuePlayer.setVolume}
        />
      )}
    </div>
  );
}
