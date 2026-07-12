# Language Learning Phrasebook — Desktop

A desktop-optimized power-user frontend for the same phrasebook data used by
`language-learning-tts-phrasebook` (mobile/driving composer) and its sibling
apps. Dense table view: filter, search, inline-edit, tag, play audio, select,
export, and delete — everything the mobile-first apps don't make easy.

**This app has no backend of its own.** It's a second frontend on top of the
existing Lambda + DynamoDB + S3 backend that `language-learning-tts-phrasebook`
owns. If you need to understand the API contract, auth scheme, or data model
in more depth, read that repo's `CLAUDE.md` and `openapi.yaml` — don't
duplicate that documentation here, just know it's the source of truth.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Table | TanStack Table (headless — all rendering/styling is ours) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`, no `tailwind.config.js` needed) |
| Export audio | Web Audio API (`OfflineAudioContext`) + `@breezystack/lamejs` for MP3 encoding, `jszip` for zipping |
| Hosting | GitHub Pages via GitHub Actions (`actions/deploy-pages`), same pattern as the tts-phrasebook repo |
| Backend | **Shared** with `language-learning-tts-phrasebook` — same Lambda Function URL, same DynamoDB table, same S3 audio bucket |

## Why a separate app instead of a mode in the existing frontend

The tts-phrasebook frontend is a mobile-first speech-bubble composer (MUI,
two themes, comic/ink aesthetic). This app is a completely different UX
paradigm — a dense, keyboard/mouse-driven data grid. Rather than cram both
into one frontend, this is a sibling app (matching the existing pattern of
`language-learning-drive-phrasebook` etc. — one repo per experience, sharing
one backend). Reuse across apps happens by hand-porting logic (see
`api/client.ts`, `api/crypto.ts`, `api/namespace.ts` — all near-verbatim
copies of the same files in tts-phrasebook), not by a shared package.

## Project Structure

```
src/
├── main.tsx                    ← bootstrap (calls initNamespace(), no StrictMode — see Gotchas)
├── App.tsx                     ← shell, just mounts PhrasesPage
├── env.d.ts                    ← import.meta.env types
├── api/
│   ├── client.ts                ← Phrase type, PhrasePatch type, listPhrases/updatePhrase/deletePhrase, getAudioUrl
│   ├── crypto.ts                 ← HMAC-TOTP token generation (identical to tts-phrasebook)
│   └── namespace.ts              ← #k= URL hash → private-library header (identical to tts-phrasebook)
├── domain/
│   └── languages.ts              ← colorForName() only — language list is derived from loaded phrases, not a static catalog
└── features/phrases/
    ├── PhrasesPage.tsx            ← top-level state owner: filters, edit-mode, study-mode, selection, wires everything together
    ├── usePhrases.ts              ← fetch + optimistic patch/remove (stable callbacks — see Gotchas)
    ├── useAudioPlayer.ts          ← single shared <Audio>, playingKey, play()/toggle-per-pace
    ├── columns.tsx                ← TanStack column defs; exports ColumnId union + StudyColumn type
    ├── PhraseTable.tsx            ← <table> rendering, fixed row height, proportional column widths
    ├── Toolbar.tsx                ← search/language/tag filters, selection count, Export button
    ├── StudyBar.tsx               ← edit-mode lock toggle + per-column "hide for quiz" checkboxes
    ├── EditableText.tsx           ← inline-editable single-line text cell
    ├── TagsEditor.tsx             ← tag chip editor with click-to-add suggestion dropdown
    ├── PlayButton.tsx             ← small ▶/■ + label button
    ├── ExportModal.tsx            ← mode picker (normal/slow/drill/recall) + zip download
    └── exportUtils.ts             ← audio fetch/render/encode/zip logic
```

## Key Design Decisions

**No separate audio files for drill/recall.** The `Phrase` schema only has
`normalS3Key`, `slowS3Key`, `translationS3Key` — three raw clips. "Drill" and
"recall" are *derived* sequences, never stored files:
- Drill: normal → 2s gap → slow → 2s gap → normal
- Recall: translation → gap (`clamp(4-12s, 2.5× translation duration)`) → normal

These gap timings match the live playback sequencers in
`language-learning-drive-phrasebook` / `-ios` / `-mobile` (their `usePlayer`).
Export renders these with `OfflineAudioContext` + re-encodes to MP3 via
`lamejs` (see `exportUtils.ts`). If a phrase has no `translationS3Key`, recall
export skips it (not fatal) and reports it in a summary. Normal/slow export
just fetches the existing S3 bytes directly — no re-encoding needed.

**Selection persists across filter changes.** `PhrasesPage`'s `selected: Set<phraseId>`
is independent of the `filtered` list. This is deliberate — it's what lets you
select all of one language, switch the filter, select all of another
language, and export the union. Don't "helpfully" reset selection on filter
change; that was explicitly requested behavior, not an oversight.

**Study mode is a locked-by-default table, not a separate view.** `editMode`
(default `false`) gates whether inline-edit inputs, tag remove buttons, and
the Delete button render at all — this exists so the table is safe to browse
one-handed while trying to recall a phrase, without fear of fat-fingering an
edit or delete. `hidden: Record<StudyColumn, boolean>` + a per-cell `revealed`
Set implement the quiz-style hide/reveal (click "Reveal" to peek one cell at a
time; a "hide revealed cells again" button resets the Set without turning
hiding off).

**No waveform scrubber.** One was built (Web Audio API decode → canvas-style
bar rendering → click/drag to seek) and then deliberately removed at the
user's request ("not working well"). `useAudioPlayer` and the Audio column
are intentionally simple: click Normal/Slow to toggle play/pause, no seek UI.
Don't re-add a waveform without explicit confirmation — it was tried once and
rejected.

## Gotchas learned the hard way (read before touching layout or state)

**Never wrap `PrhasesPage`/`main.tsx` in `<React.StrictMode>`.** StrictMode
double-invokes effects in dev, which double-fires `listPhrases()` on mount.
The backend Lambda has **reserved concurrency = 2** as an abuse-protection
measure (see tts-phrasebook's CLAUDE.md) — a burst of near-simultaneous
requests can get one throttled with an HTTP 429 that, because Lambda's
concurrency throttle fires before the handler code runs, **lacks the custom
CORS headers** our handler would normally set. The browser reports this as a
CORS failure ("No 'Access-Control-Allow-Origin' header"), which is
misleading — the real cause is StrictMode + the concurrency cap, not CORS
config. This cost real debugging time once; don't reintroduce StrictMode.

**Conditionally-mounted elements inside a `flex flex-wrap` row cause layout
shift.** This bit us three separate times (StudyBar's "hide revealed cells
again" button, Toolbar's "Clear N selected" button) — an element appearing/
disappearing changes the row's total content width, which can push it past
the wrap threshold and add a second line, growing that bar's height and
shifting everything below it. **Fix pattern: always render the element,
toggle visibility with `invisible pointer-events-none` instead of
conditionally mounting it.** Apply this same pattern to any new
conditionally-relevant button in a flex-wrap toolbar/bar.

**Variable-width text (especially digit counts) shifts layout too.** The
Export button ("Export all 9" vs "Export all 136") and the phrase-count label
both got a `min-w-[...]` + `tabular-nums` treatment so digit-count changes
don't visibly resize them. Apply the same treatment to any new element whose
text length depends on a count that changes at runtime.

**A checkbox (or any form control) nested inside a `<button>` silently eats
its own clicks.** `PhraseTable.tsx`'s header row wraps sortable columns' header
content in a `<button>` (for the sort-toggle click handler). The `select`
column's header checkbox was accidentally wrapped in that same button,
which is invalid HTML (interactive content inside interactive content) —
the checkbox's `onChange` never fired. Fix: `PhraseTable.tsx` only wraps
header content in a `<button>` when `header.column.getCanSort()` is true;
non-sortable columns (`select`, `tags`, `audio`, `actions` — all have
`enableSorting: false` in `columns.tsx`) render their header in a plain
`<div>` instead. **Any new display column with interactive header content
must have `enableSorting: false` set**, or it'll hit this same bug.

**Row height must stay fixed regardless of edit-mode/study-mode state.**
`PhraseTable.tsx` gives every `<td>` a fixed `h-12` plus `overflow-hidden`
(clipping, not just a floor) so switching between locked/unlocked or
hiding/revealing columns never changes row height — inputs, buttons, and
plain text all render inside the same fixed box regardless of which is
showing. **Exception: the `tags` column deliberately omits `overflow-hidden`**
because its click-to-add suggestion dropdown is `position: absolute` and
would get clipped by an ancestor's `overflow: hidden`. If tags ever need
that fixed-height treatment too, the dropdown must be re-architected (e.g.
a portal) first.

**Table columns use percentage widths, not fixed pixels.** Fixed pixel
widths summed to more than the app shell's available content width at any
viewport, forcing horizontal scroll even at max container width. Column
widths in `PhraseTable.tsx`'s `COLUMN_WIDTHS` are percentages summing to
100%, with `TABLE_MIN_WIDTH = 900` as a floor below which it scrolls
horizontally instead of squeezing columns unreadably thin. If you add a
column, its width must be a percentage and the others should shrink to
keep the sum at 100%.

**`scrollbar-gutter: stable` is set on `html` in `index.css`** so the
vertical scrollbar appearing/disappearing (as filtered row count changes)
doesn't shift the whole page horizontally. Don't remove it.

**This app hits the real, shared production backend — there is no separate
test/staging backend.** Any Playwright/manual verification that calls
`updatePhrase`/`deletePhrase` mutates real data used by every sibling app.
This has already happened once by accident (a test overwrote a real
phrase's `translation` and `tags`, caught and reverted via direct `curl`
calls to the Lambda). **Prefer read-only verification (`listPhrases`,
rendering, UI interaction that doesn't commit) wherever possible.** If a
mutating test is unavoidable, capture the phrase's prior state first and
revert it immediately after, the same way.

## Secrets / local dev

`.env.local` (gitignored) holds the same three values as
`language-learning-tts-phrasebook/frontend/.env` — this app talks to the
*same* Lambda, so the same `VITE_HMAC_SECRET`, `VITE_LAMBDA_URL`, and
`VITE_AUDIO_BASE_URL` work here unchanged. See `.env.example` for the shape.
No TTS proxy token is needed here — this app never calls the Google TTS
proxy; it only reads/writes already-saved phrases.

GitHub Actions secrets (`HMAC_SECRET`, `LAMBDA_URL`, `AUDIO_BASE_URL`) are
set on this repo via `gh secret set` and consumed by
`.github/workflows/deploy-frontend.yml`, mirroring tts-phrasebook's
`deploy-frontend.yml` but without a `frontend/` subdirectory (this repo's
root *is* the frontend).

## Deployment

GitHub Pages via the **GitHub Actions build source** (not a `gh-pages`
branch) — enabled once via
`gh api -X POST repos/mitch-murph/language-learning-desktop-phrasebook/pages -f build_type=workflow`.
Live at `https://mitch-murph.github.io/language-learning-desktop-phrasebook/`.
`vite.config.ts`'s `base: '/language-learning-desktop-phrasebook/'` must match
the repo name for the Pages subpath to resolve — if the repo is ever
renamed, update this too.

## Common Commands

```bash
npm install
npm run dev             # local dev server (http://localhost:5173, or pass --port)
npm run build            # tsc && vite build → dist/
npm run preview          # preview a production build locally
```

There is no test suite yet. Verification so far has been: `tsc --noEmit`,
`npm run build`, and manual/Playwright browser checks against the live
backend (read-only where possible — see Gotchas above).
