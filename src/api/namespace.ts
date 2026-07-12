const STORAGE_KEY = 'phrasebook.namespace';

/**
 * Applies a `#k=…` fragment to the stored namespace, returning true if the
 * active namespace actually changed. Mirrors the same-named module in
 * language-learning-tts-phrasebook so both apps read/write the same
 * private-library selector against the shared backend.
 */
function applyHash(): boolean {
  const raw = window.location.hash.replace(/^#/, '');
  const params = new URLSearchParams(raw);
  if (!params.has('k')) return false;

  const word = (params.get('k') ?? '').trim();
  const next = word && word.toLowerCase() !== 'default' ? word : null;
  const prev = localStorage.getItem(STORAGE_KEY);

  if (next) localStorage.setItem(STORAGE_KEY, next);
  else localStorage.removeItem(STORAGE_KEY);

  return next !== prev;
}

export function initNamespace(): void {
  applyHash();
  window.addEventListener('hashchange', () => {
    if (applyHash()) window.location.reload();
  });
}

export function getNamespace(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
