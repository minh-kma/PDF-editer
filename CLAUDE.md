# CLAUDE.md

## Project Overview

PDFdemo is a free, 100% client-side PDF editor. Users upload PDFs and merge,
split, rotate, delete, reorder (drag & drop), and compress pages — all
processing happens in the browser; no file is ever sent to a server.
In-progress work is auto-saved to IndexedDB so a page reload can be recovered.

## Tech Stack

- **React 18.3** + **TypeScript 5.6** + **Vite 5.4** (`@vitejs/plugin-react`)
- **Tailwind CSS 3.4** (+ PostCSS/autoprefixer) — styling
- **pdf-lib 1.17** — all PDF *editing* (merge/split/rotate/compress)
- **pdfjs-dist 4.7** — *rendering only* (thumbnails/previews), never editing
- **@dnd-kit** (core/sortable/utilities) — drag-to-reorder pages
- **jszip 3.10** — bundles split output into one `.zip`
- **idb-keyval 6.2** — IndexedDB session autosave
- **immer 11** — immutable state updates + undo/redo structural sharing (store)
- No test framework, no linter config, no backend. Deploys as static files
  (`netlify.toml` present; any static host works).

## Dev Commands

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:5173
npm run build     # tsc -b && vite build  → outputs dist/
npm run preview   # serve the production build locally
npx tsc --noEmit  # typecheck only (use this to verify refactors)
```

## Core Logic Summary

- The app holds an in-memory **"page plan"**: uploaded source files
  (`SourceDoc[]`) plus one ordered list of pages (`PageItem[]`), managed by an
  immer + useReducer store in `src/shared/state/store.tsx`. Edits only mutate the
  plan; real PDF bytes are produced only when the user downloads
  (`buildPdf`), splits/extracts (`splitPdf`/`extractPdf`), or compresses
  (`compressPdf`).
- Edit-group tools layer **annotations** on the plan (one generic `Annotation`
  shape per page, plus doc-level watermark/page-numbers and an image `assets`
  map). They're baked onto output by the single pipeline
  `shared/lib/annotationBake.ts`, called from `pdfCore.copyPagesToPdf` — the one
  place pages are copied and annotations drawn (decision D11).
- The store carries a whole-edit-slice **undo/redo** history (`past`/`future`,
  in-memory only, Ctrl+Z / Ctrl+Shift+Z).
- **pdf-lib edits, pdf.js draws.** Never cross these roles.
- Autosave: `App.tsx` debounce-writes the session (plan + annotations + assets)
  to IndexedDB (`shared/lib/storage.ts`, key `…:v2`); on load, a recover banner
  offers to restore.
- Details: see the docs linked below before touching this logic.

## Key Constraints

- **Never send user files anywhere.** No fetch/upload of PDF bytes, no
  analytics on file content. Privacy is the core product promise.
- **Never introduce a backend, database, or server-side processing** without
  explicit approval from the product owner.
- **Follow the feature-based folder structure** (`src/features/<group>/<module>/`
  + `src/shared/`). Do not drift back to type-based folders
  (`components/`, `lib/` at src root). See architecture doc.
- **Never auto-download results.** Always show the preview modal first
  (locked product decision).
- Keep `base: './'` in `vite.config.ts` — the build must work from a
  subfolder (e.g. GitHub Pages).
- Compress must stay **lossless** and honest: keep whichever output is
  smaller, show before/after sizes, never make the file bigger.
- The app must keep working fully offline-capable/static — no runtime
  dependencies on external services.
- User-facing copy is plain, friendly, non-technical English.

## Additional Documentation

- [.claude/docs/architecture.md](.claude/docs/architecture.md) — folder
  convention (`features/<group>/<module>/` + `shared/`), module boundaries,
  state/data-flow, how to add a feature.
- [.claude/docs/pdf-processing.md](.claude/docs/pdf-processing.md) —
  pdf-lib vs pdf.js split, `buildPdf`/`splitPdf`/`compressPdf`, thumbnail
  caching, byte-buffer ownership pitfalls, download helpers.
- [.claude/docs/persistence.md](.claude/docs/persistence.md) — IndexedDB
  session autosave/recovery: schema, debounce flow, restore quirks.

## Bug Fix Protocol
When fixing a reported bug:
1. Diagnose the root cause before editing code; briefly state it.
2. Fix only the reported issue — no unrelated refactors.
3. After all fixes in the batch: npx tsc --noEmit && npm run build.
4. List changed files per item.

## CLAUDE.md Maintenance
If a fix or feature reveals a wrong assumption, a new convention, or
a structural change, flag it at the end of your response with:
"Suggest updating CLAUDE.md: [what and why]" — but do not edit
CLAUDE.md yourself unless explicitly asked.

## Session Continuity
CLAUDE.md loads automatically each session — never ask me to re-read it.
Files under .claude/docs/ do not auto-load; read only the ones relevant
to the current task, and only if not already read this session.
