// Browser-side TTS, ported from language-learning-tts-phrasebook's api/tts.ts.
// The proxy URL (including its short-lived ?token=…) is pasted by the user and
// kept in localStorage; the Lambda never sees it.

export type Pace = 'slow' | 'normal';

export const TTS_DEMO_URL = 'https://cloud.google.com/text-to-speech';
const TTS_URL_KEY = 'ttsUrl';

const DEFAULT_PROMPTS: Record<Pace, string> = {
  normal: 'Speak like a calm language tutor. Read the phrase clearly.',
  slow: 'Speak like a calm language tutor. Slowly with a clear pause between each syllable.',
};

const ACCENT_PROMPTS: Record<string, string> = {
  Vietnamese: ' Use a Southern Vietnamese accent.',
  'Vietnamese (Northern)': ' Use a Northern Vietnamese accent.',
};

export const TRANSLATION_PROMPT = 'Speak in a fast, neutral, even tone.';

export function getTtsUrl(): string {
  try {
    return localStorage.getItem(TTS_URL_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setTtsUrl(url: string) {
  localStorage.setItem(TTS_URL_KEY, url.trim());
}

export class TtsError extends Error {
  constructor(
    message: string,
    public unsupportedLanguage = false,
    public noUrl = false,
    public unauthorized = false,
    public status = 0,
  ) {
    super(message);
    this.name = 'TtsError';
  }
}

/** True when the failure means "the user needs a (new) proxy token". */
export function needsToken(e: unknown): boolean {
  // 500 is what the proxy returns for a bad/expired token or a malformed URL.
  return e instanceof TtsError && (e.noUrl || e.unauthorized || [403, 500].includes(e.status));
}

const DEFAULT_TARGET = 'https://texttospeech.googleapis.com/v1beta1/text:synthesize';

/**
 * Accepts whatever the user pasted from the network tab and returns a full
 * proxy URL. Fills in the missing `url=` target (the proxy 500s without it)
 * and accepts a bare token. Returns '' if no token can be found.
 */
export function normalizeTtsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let token = '';
  let target = '';
  try {
    const u = new URL(trimmed);
    token = u.searchParams.get('token') ?? '';
    target = u.searchParams.get('url') ?? '';
  } catch {
    if (!/\s/.test(trimmed) && !trimmed.includes('/')) token = trimmed.replace(/^token=/, '');
  }
  if (!token) return '';
  return `https://cxl-services.appspot.com/proxy?url=${target || DEFAULT_TARGET}&token=${token}`;
}

function promptFor(pace: Pace, languageName: string): string {
  return DEFAULT_PROMPTS[pace] + (ACCENT_PROMPTS[languageName] ?? '');
}

async function post(url: string, text: string, languageCode: string, prompt: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({
      input: { text, prompt },
      voice: { languageCode, name: 'Charon', modelName: 'gemini-3.1-flash-tts-preview' },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1 },
    }),
  });
}

/** Returns base64 MP3 audio. */
export async function callTts(
  text: string,
  languageCode: string,
  pace: Pace,
  languageName = '',
  overridePrompt?: string,
  urlOverride?: string,
): Promise<string> {
  const url = urlOverride ?? getTtsUrl();
  if (!url) throw new TtsError('TTS URL not set.', false, true);
  const res = await post(url, text, languageCode, overridePrompt ?? promptFor(pace, languageName));
  if (!res.ok) {
    const raw = await res.text();
    let message = `TTS ${res.status}: ${raw}`;
    let unsupported = false;
    try {
      const inner = JSON.parse(raw)?.error?.message;
      if (typeof inner === 'string' && inner.length) message = inner;
      if (res.status === 400 && /language code.*not supported/i.test(inner ?? '')) unsupported = true;
    } catch {
      /* keep fallback message */
    }
    throw new TtsError(message, unsupported, false, res.status === 401, res.status);
  }
  const { audioContent } = await res.json();
  return audioContent as string;
}
