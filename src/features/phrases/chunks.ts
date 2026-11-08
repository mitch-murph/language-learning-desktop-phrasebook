/** Splits a phrase into learnable pieces. Spaced scripts split on whitespace;
 *  others (Chinese, Japanese, Thai…) fall back to Intl.Segmenter word breaks. */
export function splitIntoChunks(text: string, languageCode: string): { chunks: string[]; joiner: string } {
  const trimmed = text.trim();
  if (/\s/.test(trimmed)) {
    return { chunks: trimmed.split(/\s+/).filter(Boolean), joiner: ' ' };
  }
  try {
    // Intl.Segmenter is missing from this project's TS lib target.
    const Segmenter = (Intl as any).Segmenter;
    const seg = new Segmenter(languageCode, { granularity: 'word' });
    const chunks: string[] = [...seg.segment(trimmed)]
      .filter((s: any) => s.isWordLike)
      .map((s: any) => s.segment as string);
    if (chunks.length > 1) return { chunks, joiner: '' };
  } catch {
    /* unsupported locale: fall through */
  }
  return { chunks: trimmed ? [trimmed] : [], joiner: ' ' };
}
