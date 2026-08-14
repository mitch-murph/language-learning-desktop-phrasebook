import JSZip from 'jszip';
import { getAudioUrl, type Phrase } from '../../api/client';

export type ExportMode = 'normal' | 'slow' | 'fast' | 'drill' | 'fastDrill' | 'recall' | 'recallDrill' | 'reverseRecall';
export type ExportStage = 'fetch' | 'encode';
export type ExportProgressCallback = (done: number, total: number, stage: ExportStage) => void;

const DRILL_STEP_GAP_SEC = 2;
const FAST_STEP_GAP_SEC = 0.3;
const RECALL_MIN_GAP_SEC = 4;
const RECALL_MAX_GAP_SEC = 12;
const RECALL_GAP_MULTIPLIER = 2.5;
const RECALL_DRILL_MIN_GAP_SEC = 8;
const RECALL_DRILL_MAX_GAP_SEC = 24;
const RECALL_DRILL_GAP_MULTIPLIER = 5;
const PHRASE_GAP_SEC = 3;
const MP3_BITRATE = 128;
const MP3_BLOCK_SIZE = 1152; // samples per LAME frame

// ZIP export gives one file per phrase, which a phone plays back-to-back as separate
// tracks with zero gap between them. Drill-family modes get lead-in/trail-out silence
// so consecutive tracks don't run into each other; other modes are quick enough single
// clips that this hasn't been requested for them.
const TRACK_PAD_SEC = 1;
const DRILL_FAMILY_MODES: ExportMode[] = ['drill', 'fastDrill', 'recallDrill'];

// Modes whose combined-export gap between phrases should mirror their much
// shorter live-playback pause, instead of the standard PHRASE_GAP_SEC.
const COMBINED_PHRASE_GAP_SEC: Record<ExportMode, number> = {
  normal: PHRASE_GAP_SEC,
  slow: PHRASE_GAP_SEC,
  fast: FAST_STEP_GAP_SEC,
  drill: PHRASE_GAP_SEC,
  fastDrill: FAST_STEP_GAP_SEC,
  recall: PHRASE_GAP_SEC,
  recallDrill: PHRASE_GAP_SEC,
  reverseRecall: PHRASE_GAP_SEC,
};

function sanitizeFilename(s: string): string {
  return (
    s
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .trim()
      .slice(0, 80) || 'phrase'
  );
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  const unique = `${base}-${n}`;
  used.add(unique);
  return unique;
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch audio (${res.status})`);
  return res.arrayBuffer();
}

async function decodeAudio(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  return ctx.decodeAudioData(await fetchBytes(url));
}

function floatToInt16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function tagMp3(mp3: ArrayBuffer, tags: { title: string; artist: string; album: string; trackNumber?: number }): Promise<ArrayBuffer> {
  const { ID3Writer } = await import('browser-id3-writer');
  const writer = new ID3Writer(mp3);
  writer.setFrame('TIT2', tags.title);
  writer.setFrame('TPE1', [tags.artist]);
  writer.setFrame('TALB', tags.album);
  if (tags.trackNumber !== undefined) writer.setFrame('TRCK', String(tags.trackNumber));
  return writer.addTag();
}

async function audioBufferToMp3(buffer: AudioBuffer): Promise<Uint8Array> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(1, buffer.sampleRate, MP3_BITRATE);
  const pcm = floatToInt16(buffer.getChannelData(0));
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < pcm.length; i += MP3_BLOCK_SIZE) {
    const encoded = encoder.encodeBuffer(pcm.subarray(i, i + MP3_BLOCK_SIZE));
    if (encoded.length > 0) chunks.push(encoded);
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(flushed);

  const total = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    result.set(c, off);
    off += c.length;
  }
  return result;
}

function renderSequence(segments: { buffer: AudioBuffer; gapAfterSec: number }[]): Promise<AudioBuffer> {
  const totalSec = segments.reduce((s, seg) => s + seg.buffer.duration + seg.gapAfterSec, 0);
  // Match the decoded buffers' own sample rate instead of hardcoding one — mixing a
  // buffer into an OfflineAudioContext running at a different rate forces the browser
  // to resample on the fly, which some mobile browsers audibly distort. All segments
  // here were decoded via the same AudioContext, so they already share one rate.
  const sampleRate = segments[0].buffer.sampleRate;
  const offline = new OfflineAudioContext(1, Math.ceil(totalSec * sampleRate), sampleRate);

  let offsetSec = 0;
  for (const seg of segments) {
    const src = offline.createBufferSource();
    src.buffer = seg.buffer;
    src.connect(offline.destination);
    src.start(offsetSec);
    offsetSec += seg.buffer.duration + seg.gapAfterSec;
  }
  return offline.startRendering();
}

function padSilence(buffer: AudioBuffer, leadSec: number, trailSec: number): Promise<AudioBuffer> {
  const lead = new AudioBuffer({
    numberOfChannels: 1,
    length: Math.ceil(leadSec * buffer.sampleRate),
    sampleRate: buffer.sampleRate,
  });
  return renderSequence([
    { buffer: lead, gapAfterSec: 0 },
    { buffer, gapAfterSec: trailSec },
  ]);
}

function scaledGapSec(durationSec: number, multiplier: number, minSec: number, maxSec: number): number {
  return Math.min(maxSec, Math.max(minSec, durationSec * multiplier));
}

function requireTranslation(phrase: Phrase, modeLabel: string): string {
  if (!phrase.translationS3Key) {
    throw new Error(`No translation audio saved for this phrase — ${modeLabel} mode needs one.`);
  }
  return phrase.translationS3Key;
}

// normal → gap → slow → gap → normal
async function renderDrill(ctx: AudioContext, phrase: Phrase): Promise<AudioBuffer> {
  const normalBuf = await decodeAudio(ctx, getAudioUrl(phrase.normalS3Key));
  const slowBuf = await decodeAudio(ctx, getAudioUrl(phrase.slowS3Key));
  return renderSequence([
    { buffer: normalBuf, gapAfterSec: DRILL_STEP_GAP_SEC },
    { buffer: slowBuf, gapAfterSec: DRILL_STEP_GAP_SEC },
    { buffer: normalBuf, gapAfterSec: 0 },
  ]);
}

// The drill sequence with fast-style compressed gaps throughout.
async function renderFastDrill(ctx: AudioContext, phrase: Phrase): Promise<AudioBuffer> {
  const normalBuf = await decodeAudio(ctx, getAudioUrl(phrase.normalS3Key));
  const slowBuf = await decodeAudio(ctx, getAudioUrl(phrase.slowS3Key));
  return renderSequence([
    { buffer: normalBuf, gapAfterSec: FAST_STEP_GAP_SEC },
    { buffer: slowBuf, gapAfterSec: FAST_STEP_GAP_SEC },
    { buffer: normalBuf, gapAfterSec: 0 },
  ]);
}

// translation → gap (scaled to give recall time) → normal (the reveal)
async function renderRecall(ctx: AudioContext, phrase: Phrase): Promise<AudioBuffer> {
  const translationKey = requireTranslation(phrase, 'recall');
  const translationBuf = await decodeAudio(ctx, getAudioUrl(translationKey));
  const normalBuf = await decodeAudio(ctx, getAudioUrl(phrase.normalS3Key));
  const gapSec = scaledGapSec(translationBuf.duration, RECALL_GAP_MULTIPLIER, RECALL_MIN_GAP_SEC, RECALL_MAX_GAP_SEC);
  return renderSequence([
    { buffer: translationBuf, gapAfterSec: gapSec },
    { buffer: normalBuf, gapAfterSec: 0 },
  ]);
}

// Recall's translation lead-in (a longer gap, to give more time to recall
// before the drill reveal), then a full drill rep.
async function renderRecallDrill(ctx: AudioContext, phrase: Phrase): Promise<AudioBuffer> {
  const translationKey = requireTranslation(phrase, 'recall drill');
  const translationBuf = await decodeAudio(ctx, getAudioUrl(translationKey));
  const normalBuf = await decodeAudio(ctx, getAudioUrl(phrase.normalS3Key));
  const slowBuf = await decodeAudio(ctx, getAudioUrl(phrase.slowS3Key));
  const leadInGapSec = scaledGapSec(
    translationBuf.duration,
    RECALL_DRILL_GAP_MULTIPLIER,
    RECALL_DRILL_MIN_GAP_SEC,
    RECALL_DRILL_MAX_GAP_SEC,
  );
  return renderSequence([
    { buffer: translationBuf, gapAfterSec: leadInGapSec },
    { buffer: normalBuf, gapAfterSec: DRILL_STEP_GAP_SEC },
    { buffer: slowBuf, gapAfterSec: DRILL_STEP_GAP_SEC },
    { buffer: normalBuf, gapAfterSec: 0 },
  ]);
}

// Mirror of recall: normal → gap (scaled to give recall time) → translation (the reveal)
async function renderReverseRecall(ctx: AudioContext, phrase: Phrase): Promise<AudioBuffer> {
  const translationKey = requireTranslation(phrase, 'reverse recall');
  const normalBuf = await decodeAudio(ctx, getAudioUrl(phrase.normalS3Key));
  const translationBuf = await decodeAudio(ctx, getAudioUrl(translationKey));
  const gapSec = scaledGapSec(normalBuf.duration, RECALL_GAP_MULTIPLIER, RECALL_MIN_GAP_SEC, RECALL_MAX_GAP_SEC);
  return renderSequence([
    { buffer: normalBuf, gapAfterSec: gapSec },
    { buffer: translationBuf, gapAfterSec: 0 },
  ]);
}

// Resolves the single AudioBuffer that represents one phrase in the given mode —
// a plain decode for normal/slow/fast, a rendered multi-clip sequence otherwise.
async function renderPhraseSegment(ctx: AudioContext, phrase: Phrase, mode: ExportMode): Promise<AudioBuffer> {
  if (mode === 'normal' || mode === 'fast') return decodeAudio(ctx, getAudioUrl(phrase.normalS3Key));
  if (mode === 'slow') return decodeAudio(ctx, getAudioUrl(phrase.slowS3Key));
  if (mode === 'drill') return renderDrill(ctx, phrase);
  if (mode === 'fastDrill') return renderFastDrill(ctx, phrase);
  if (mode === 'recall') return renderRecall(ctx, phrase);
  if (mode === 'recallDrill') return renderRecallDrill(ctx, phrase);
  return renderReverseRecall(ctx, phrase);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ExportResult {
  skipped: { phrase: Phrase; reason: string }[];
}

export async function downloadZip(
  phrases: Phrase[],
  mode: ExportMode,
  album: string,
  onProgress: ExportProgressCallback,
): Promise<ExportResult> {
  const zip = new JSZip();
  const used = new Set<string>();
  const rawFetchModes: ExportMode[] = ['normal', 'slow', 'fast'];
  const needsRendering = !rawFetchModes.includes(mode);
  const ctx = needsRendering ? new AudioContext() : null;
  const skipped: ExportResult['skipped'] = [];

  for (let pi = 0; pi < phrases.length; pi++) {
    const phrase = phrases[pi];
    const name = uniqueName(sanitizeFilename(phrase.translation || phrase.text), used);

    try {
      let bytes: ArrayBuffer;
      if (mode === 'normal' || mode === 'fast') {
        bytes = await fetchBytes(getAudioUrl(phrase.normalS3Key));
      } else if (mode === 'slow') {
        bytes = await fetchBytes(getAudioUrl(phrase.slowS3Key));
      } else {
        let rendered = await renderPhraseSegment(ctx!, phrase, mode);
        if (DRILL_FAMILY_MODES.includes(mode)) rendered = await padSilence(rendered, TRACK_PAD_SEC, TRACK_PAD_SEC);
        const mp3 = await audioBufferToMp3(rendered);
        bytes = mp3.buffer as ArrayBuffer;
      }
      const tagged = await tagMp3(bytes, {
        title: phrase.translation || (phrase.nonLatin && phrase.transcription) || phrase.text || 'Phrase',
        artist: phrase.languageName,
        album,
        trackNumber: pi + 1,
      });
      zip.file(`${name}.mp3`, tagged);
    } catch (e) {
      used.delete(name);
      skipped.push({ phrase, reason: e instanceof Error ? e.message : String(e) });
    }

    onProgress(pi + 1, phrases.length, 'fetch');
  }

  ctx?.close();

  if (zip.file(/.*/).length > 0) {
    const blob = await zip.generateAsync({ type: 'blob' });
    triggerDownload(blob, `phrases-${mode}.zip`);
  }

  return { skipped };
}

// One combined MP3: every phrase's rendered segment for `mode`, back-to-back with
// COMBINED_PHRASE_GAP_SEC[mode] of silence between phrases (no gap after the last one).
export async function downloadCombined(
  phrases: Phrase[],
  mode: ExportMode,
  album: string,
  onProgress: ExportProgressCallback,
): Promise<ExportResult> {
  const ctx = new AudioContext();
  const skipped: ExportResult['skipped'] = [];
  const segments: { buffer: AudioBuffer; gapAfterSec: number }[] = [];

  for (let pi = 0; pi < phrases.length; pi++) {
    const phrase = phrases[pi];
    try {
      const buffer = await renderPhraseSegment(ctx, phrase, mode);
      segments.push({ buffer, gapAfterSec: COMBINED_PHRASE_GAP_SEC[mode] });
    } catch (e) {
      skipped.push({ phrase, reason: e instanceof Error ? e.message : String(e) });
    }
    onProgress(pi + 1, phrases.length, 'fetch');
  }

  ctx.close();

  if (segments.length === 0) return { skipped };
  segments[segments.length - 1].gapAfterSec = 0;

  onProgress(phrases.length, phrases.length, 'encode');
  const rendered = await renderSequence(segments);
  const mp3 = await audioBufferToMp3(rendered);
  const tagged = await tagMp3(mp3.buffer as ArrayBuffer, { title: `${album} (combined)`, artist: album, album });
  triggerDownload(new Blob([tagged], { type: 'audio/mpeg' }), `phrases-${mode}-combined.mp3`);

  return { skipped };
}
