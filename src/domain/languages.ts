export function colorForName(name: string | undefined): string {
  const key = (name ?? '').toLowerCase();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 75%, 40%)`;
}

export interface Language {
  code: string;
  name: string;
  nonLatin: boolean;
}

export function languagesFromPhrases(
  phrases: { languageCode: string; languageName: string; nonLatin: boolean }[],
): Language[] {
  const seen = new Map<string, Language>();
  for (const p of phrases) {
    if (!seen.has(p.languageName)) {
      seen.set(p.languageName, { code: p.languageCode, name: p.languageName, nonLatin: p.nonLatin });
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}
