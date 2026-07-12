import { useCallback, useEffect, useState } from 'react';
import { deletePhrase, listPhrases, updatePhrase, type Phrase } from '../../api/client';

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

  const patch = useCallback(
    async (phraseId: string, fields: { transcription?: string; translation?: string; tags?: string[] }) => {
      const prev = phrases;
      setPhrases(list => list.map(p => (p.phraseId === phraseId ? { ...p, ...fields } : p)));
      try {
        await updatePhrase(phraseId, fields);
      } catch (e) {
        setPhrases(prev);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [phrases],
  );

  const remove = useCallback(
    async (phraseId: string) => {
      const prev = phrases;
      setPhrases(list => list.filter(p => p.phraseId !== phraseId));
      try {
        await deletePhrase(phraseId);
      } catch (e) {
        setPhrases(prev);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [phrases],
  );

  return { phrases, loading, error, patch, remove };
}
