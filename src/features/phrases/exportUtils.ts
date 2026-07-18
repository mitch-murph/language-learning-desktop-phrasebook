import JSZip from 'jszip';
import { getAudioUrl, type Phrase } from '../../api/client';

export type ExportMode = 'normal' | 'slow' | 'drill' | 'recall';
export type ExportStage = 'fetch' | 'encode';
export type ExportProgressCallback = (done: number, total: number, stage: ExportStage) => void;

const DRILL_STEP_GAP_SEC = 2;
const RECALL_MIN_GAP_SEC = 4;
const RECALL_MAX_GAP_SEC = 12;
const RECALL_GAP_MULTIPLIER = 2.5;
const PHRASE_GAP_SEC = 3;
const MP3_BITRATE = 128;
const MP3_BLOCK_SIZE = 1152; // samples per LAME frame

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
  const sampleRate = 44100;
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

// translation → gap (scaled to give recall time) → normal (the reveal)
async function renderRecall(ctx: AudioContext, phrase: Phrase): Promise<AudioBuffer> {
  if (!phrase.translationS3Key) {
    throw new Error('No translation audio saved for this phrase — recall mode needs one.');
  }
  const translationBuf = await decodeAudio(ctx, getAudioUrl(phrase.translationS3Key));
  const normalBuf = await decodeAudio(ctx, getAudioUrl(phrase.normalS3Key));
  const gapSec = Math.min(
    RECALL_MAX_GAP_SEC,
    Math.max(RECALL_MIN_GAP_SEC, translationBuf.duration * RECALL_GAP_MULTIPLIER),
  );
  return renderSequence([
    { buffer: translationBuf, gapAfterSec: gapSec },
    { buffer: normalBuf, gapAfterSec: 0 },
  ]);
}

// Resolves the single AudioBuffer that represents one phrase in the given mode —
// a plain decode for normal/slow, a rendered multi-clip sequence for drill/recall.
async function renderPhraseSegment(ctx: AudioContext, phrase: Phrase, mode: ExportMode): Promise<AudioBuffer> {
  if (mode === 'normal') return decodeAudio(ctx, getAudioUrl(phrase.normalS3Key));
  if (mode === 'slow') return decodeAudio(ctx, getAudioUrl(phrase.slowS3Key));
  if (mode === 'drill') return renderDrill(ctx, phrase);
  return renderRecall(ctx, phrase);
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
  onProgress: ExportProgressCallback,
): Promise<ExportResult> {
  const zip = new JSZip();
  const used = new Set<string>();
  const needsRendering = mode === 'drill' || mode === 'recall';
  const ctx = needsRendering ? new AudioContext() : null;
  const skipped: ExportResult['skipped'] = [];

  for (let pi = 0; pi < phrases.length; pi++) {
    const phrase = phrases[pi];
    const name = uniqueName(sanitizeFilename(phrase.translation || phrase.text), used);

    try {
      if (mode === 'normal') {
        zip.file(`${name}.mp3`, await fetchBytes(getAudioUrl(phrase.normalS3Key)));
      } else if (mode === 'slow') {
        zip.file(`${name}.mp3`, await fetchBytes(getAudioUrl(phrase.slowS3Key)));
      } else if (mode === 'drill') {
        const rendered = await renderDrill(ctx!, phrase);
        const mp3 = await audioBufferToMp3(rendered);
        zip.file(`${name}.mp3`, mp3.buffer as ArrayBuffer);
      } else {
        const rendered = await renderRecall(ctx!, phrase);
        const mp3 = await audioBufferToMp3(rendered);
        zip.file(`${name}.mp3`, mp3.buffer as ArrayBuffer);
      }
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
// PHRASE_GAP_SEC of silence between phrases (no gap after the last one).
export async function downloadCombined(
  phrases: Phrase[],
  mode: ExportMode,
  onProgress: ExportProgressCallback,
): Promise<ExportResult> {
  const ctx = new AudioContext();
  const skipped: ExportResult['skipped'] = [];
  const segments: { buffer: AudioBuffer; gapAfterSec: number }[] = [];

  for (let pi = 0; pi < phrases.length; pi++) {
    const phrase = phrases[pi];
    try {
      const buffer = await renderPhraseSegment(ctx, phrase, mode);
      segments.push({ buffer, gapAfterSec: PHRASE_GAP_SEC });
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
  triggerDownload(new Blob([mp3.buffer as ArrayBuffer], { type: 'audio/mpeg' }), `phrases-${mode}-combined.mp3`);

  return { skipped };
}
