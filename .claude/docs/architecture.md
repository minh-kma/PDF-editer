# PDFdemo — Project Architecture

PDFdemo is a 100% client-side (in-browser) PDF editor. Nothing is ever
uploaded; all PDF work runs in the browser via `pdf-lib` (editing) and
`pdf.js` (rendering). The build output is pure static files.

## Folder structure: feature-based (do not drift)

Code is organized by **feature**, not by technical type. Each PDF operation
lives as a self-contained module under `src/features/`, with cross-cutting
code centralized in `src/shared/`. The goal: add new features without touching
unrelated code.

**Anti-pattern to avoid:** do not recreate type-based folders like
`src/components/` or `src/lib/` at the src root, and do not put
feature-specific code into `shared/`. New UI + logic for a feature belongs in
that feature's module folder.

```
src/
  App.tsx            Top-level composition — wires features + shared UI, owns
                     preview/error/busy orchestration and the autosave effects
  main.tsx           Entry point (StrictMode + StoreProvider)
  index.css          Global styles (Tailwind layers + component classes)

  features/
    <group>/         A group of related features
      <module>/      One self-contained feature: its own UI + its own logic

  shared/            Cross-cutting code used by more than one feature
    components/      Reusable UI: Modal, Toast, icons, DropZone, Header,
                     PreviewModal, RecoverBanner, BusyOverlay
    lib/             Helpers: download, format, pdfjs (render), thumbnails,
                     storage (IndexedDB), pdfCore (shared pdf-lib primitives)
    state/           App store (store.tsx: useReducer + context) and
                     data types (types.ts: SourceDoc, PageItem, AppState)
```

## The `features/<group>/<module>/` convention

- A **group** bundles related features (currently only `page-management`).
- A **module** is one self-contained feature inside a group, holding both its
  UI and its logic. A module may be UI-only, logic-only, or both.
- Anything used by **two or more** modules is **not** duplicated — it moves to
  `shared/`.
- Modules must not import from sibling modules. If two modules need the same
  code, that code belongs in `shared/`.

### Current group: `page-management`

```
features/page-management/
  workspace/    Workspace.tsx (thumbnail grid + dnd-kit reorder),
                PageThumb.tsx (one page card: rotate/delete buttons),
                Toolbar.tsx (action bar), buildPdf.ts (assemble output)
  split/        SplitPanel.tsx (range UI + JSZip download) + splitPdf.ts
  compress/     compressPdf.ts (lossless re-save; result UI lives in App.tsx)
```

**Why merge/delete/reorder/rotate share one `workspace/` module:** they all
operate on the same page plan and are assembled together by `buildPdf.ts`.
Splitting them into four modules would create artificial coupling — they are
one feature (the workspace), not four.

`shared/lib/pdfCore.ts` holds pdf-lib primitives (`loadSources`) used by both
`workspace/buildPdf.ts` and `split/splitPdf.ts`.

### Planned future groups

The product roadmap has four feature groups: **Organize**, **Optimize**,
**Edit**, **Security** (see `.claude/docs/features.md`). `page-management`
already covers the built Organize + workspace features. Create a group's
folder only when work on it begins (no empty placeholders). Likely homes:

- `optimize/` — e.g. OCR (Compress already lives under `page-management/`, see below)
- `edit/` — annotation tools (text, highlights, signatures, shapes) + page numbers, watermark, crop, forms
- `security/` — e.g. password protect

### Code location vs. roadmap group

A feature's **code folder** is chosen by real code coupling, not by its
product-roadmap group name (decision **D2**). So some features live under a
group that doesn't literally match their roadmap group — intentionally:

- **Rotate** is roadmap-group *Edit* but lives in
  `page-management/workspace/` — it mutates the same page plan and is
  assembled by `buildPdf.ts` alongside merge/delete/reorder.
- **Compress** is roadmap-group *Optimize* but lives in
  `page-management/compress/` — it builds on the assembled page plan.

When reading the roadmap against the folder tree, expect this. New features
should follow the same principle: co-locate by what shares code, not by
product-group name.

## State & data flow

Single store, no external state library: `shared/state/store.tsx` is a
`useReducer` + React context (`StoreProvider` in `main.tsx`, consumed via
`useStore()`).

- **State:** `sources: SourceDoc[]` (uploaded files, original bytes untouched)
  and `pages: PageItem[]` (the ordered "page plan"), plus `busy`/`busyMessage`.
- **Edits are plan mutations only** (reducer actions: ADD_SOURCE, DELETE_PAGE,
  ROTATE_PAGE, ROTATE_ALL, REORDER, RESET, RESTORE, SET_BUSY). No PDF bytes
  are produced until the user downloads/splits/compresses.
- **Flow:** DropZone → `App.handleFiles` → `addSource` (one PageItem per
  page) → Workspace renders the plan → toolbar/actions call feature logic →
  result shown in PreviewModal → download.
- Module-level caches (pdf.js doc cache, thumbnail cache) intentionally live
  **outside** React — see `.claude/docs/pdf-processing.md`.

## Adding a new feature — checklist

1. Pick or create the right `features/<group>/`.
2. Add a `<module>/` folder with the feature's UI and logic files.
3. Import cross-cutting pieces from `shared/`; if you'd copy something a
   second time, move it to `shared/` instead. Never import from a sibling
   module.
4. If it needs new app state, extend the reducer in `shared/state/store.tsx`;
   keep feature-local UI state (inputs, open/closed) inside the module.
5. Wire the feature into `App.tsx`.
6. Verify: `npx tsc --noEmit` → `npm run build` → `npm run dev` + manual check.

## Build & deploy notes

- `vite.config.ts` sets `base: './'` so the built app works from a subfolder
  (GitHub Pages etc.). Do not remove.
- `tsconfig.node.json` redirects its emit into `node_modules/.tmp/` — do not
  let `tsc -b` emit `vite.config.js`/`.d.ts` next to the source (they are
  gitignored as a safety net).
- `netlify.toml` defines the optional auto-deploy (`npm run build` → `dist/`).
