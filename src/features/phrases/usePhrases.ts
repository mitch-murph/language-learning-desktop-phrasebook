import { useCallback, useEffect, useState } from 'react';
import { deletePhrase, listPhrases, updatePhrase, type Phrase, type PhrasePatch } from '../../api/client';

export function usePhrases() {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listPhrases()
      .then(setPhrases)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  // Snapshot is captured from the setState updater itself (not a `phrases`
  // dependency) so patch/remove keep a stable identity across renders —
  // otherwise every edit would rebuild the table's column definitions.
  const patch = useCallback(async (phraseId: string, fields: PhrasePatch) => {
    let snapshot: Phrase[] = [];
    setPhrases(list => {
      snapshot = list;
      return list.map(p => (p.phraseId === phraseId ? { ...p, ...fields } : p));
    });
    try {
      await updatePhrase(phraseId, fields);
    } catch (e) {
      setPhrases(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const remove = useCallback(async (phraseId: string) => {
    let snapshot: Phrase[] = [];
    setPhrases(list => {
      snapshot = list;
      return list.filter(p => p.phraseId !== phraseId);
    });
    try {
      await deletePhrase(phraseId);
    } catch (e) {
      setPhrases(snapshot);
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return { phrases, loading, error, patch, remove };
}
