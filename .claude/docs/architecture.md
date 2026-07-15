# PDFdemo — Project Architecture

PDFdemo is a 100% client-side (in-browser) PDF editor. Nothing is ever
uploaded; all PDF work runs in the browser via `pdf-lib` and `pdf.js`.

## Folder structure: feature-based

Code is organized by **feature**, not by technical type. The goal is easy
long-term maintenance and adding new features without touching unrelated code.

```
src/
  App.tsx            Top-level composition — wires features + shared UI together
  main.tsx           App entry point
  index.css          Global styles

  features/
    <group>/         A group of related features (see convention below)
      <module>/      One self-contained feature: its own UI + its own logic
        ...

  shared/            Cross-cutting code used by more than one feature
    components/       Reusable UI (Modal, Toast, icons, DropZone, ...)
    lib/              Reusable helpers (download, format, pdfjs, thumbnails,
                      storage, pdfCore)
    state/            The shared app store (store.tsx) + types (types.ts)
```

## The `features/<group>/<module>/` convention

- A **group** bundles related features (e.g. `page-management`).
- A **module** is one self-contained feature inside a group, holding both its
  UI and its logic. A module may be UI-only, logic-only, or both.
- Anything used by **two or more** modules is **not** duplicated — it moves to
  `shared/`.

### Current group: `page-management`

```
features/page-management/
  workspace/    Upload, page thumbnails, rotate, delete, reorder, and the
                merge/assemble step. These share one page model and are
                assembled together by buildPdf.ts — so they stay together
                rather than being split into four artificial modules.
  split/        SplitPanel.tsx (UI) + splitPdf.ts (logic)
  compress/     compressPdf.ts (logic; triggered from the workspace toolbar,
                previewed via the shared PreviewModal)
```

`shared/lib/pdfCore.ts` holds PDF-assembly primitives (`loadSources`) used by
both `workspace/buildPdf.ts` and `split/splitPdf.ts`.

### Planned future groups

New feature groups get their own folder under `features/` when work on them
begins (no empty placeholder folders are created ahead of time):

- `conversion/` — e.g. PDF ↔ images, other format conversions
- `editing-annotations/` — e.g. text, highlights, shapes, signatures

## Adding a new feature — checklist

1. Pick or create the right `features/<group>/`.
2. Add a `<module>/` folder with the feature's UI and logic.
3. Import cross-cutting pieces from `shared/`; if you find yourself copying
   something a second time, move it into `shared/` instead.
4. Wire the feature into `App.tsx`.
