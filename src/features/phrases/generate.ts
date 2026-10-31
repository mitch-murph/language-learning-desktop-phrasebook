import { getAudioUrl, savePhrase, type Phrase } from '../../api/client';
import { callTts, TRANSLATION_PROMPT } from '../../api/tts';

export interface PhraseDraft {
  text: string;
  languageCode: string;
  languageName: string;
  nonLatin: boolean;
  transcription?: string;
  translation?: string;
  tags?: string[];
  hide?: boolean;
}

/**
 * Synthesizes normal + slow (+ translation) audio in the browser, then saves
 * the phrase. `ttsCode` overrides the voice language only (fallback retries);
 * the stored languageCode stays the draft's.
 */
export async function generateAndSave(
  draft: PhraseDraft,
  ttsCode = draft.languageCode,
  /** Clips already synthesized for this exact text + voice (e.g. by Listen). */
  prefetched: { normal?: string; slow?: string; translation?: string } = {},
): Promise<Phrase> {
  const translation = draft.translation?.trim() || undefined;
  const [normalAudioBase64, slowAudioBase64, translationAudioBase64] = await Promise.all([
    prefetched.normal ?? callTts(draft.text, ttsCode, 'normal', draft.languageName),
    prefetched.slow ?? callTts(draft.text, ttsCode, 'slow', draft.languageName),
    translation
      ? (prefetched.translation ?? callTts(translation, 'en-US', 'normal', '', TRANSLATION_PROMPT))
      : Promise.resolve(undefined),
  ]);
  return savePhrase({
    text: draft.text,
    languageCode: draft.languageCode,
    languageName: draft.languageName,
    nonLatin: draft.nonLatin,
    normalAudioBase64,
    slowAudioBase64,
    transcription: draft.transcription?.trim() || undefined,
    translation,
    translationAudioBase64,
    tags: draft.tags && draft.tags.length > 0 ? draft.tags : undefined,
    hide: draft.hide || undefined,
  });
}

/**
 * Audio keys are content-addressed by text, so regenerating the same text
 * overwrites the same S3 objects at the same URLs. A cache-bypassing fetch
 * refreshes the browser's HTTP cache entry so playback doesn't serve the old clip.
 */
export async function refreshAudioCache(p: Phrase): Promise<void> {
  const keys = [p.normalS3Key, p.slowS3Key, p.translationS3Key].filter((k): k is string => !!k);
  await Promise.all(keys.map(k => fetch(getAudioUrl(k), { cache: 'reload' }).catch(() => undefined)));
}
