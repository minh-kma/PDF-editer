# PDFdemo — Feature Roadmap

Client-side PDF toolkit. All processing runs in the browser. No backend,
no database, no file uploads. Ad-funded (decisions.md D12).

## Group 1: Organize

| Feature | Status |
|---|---|
| Merge | Built |
| Split | Built |
| Remove pages | Built |
| Rearrange pages | Built |
| Extract pages | Built |

## Group 2: Optimize

| Feature | Status | Notes |
|---|---|---|
| Compress | Built | |
| OCR | Recognition built, no UI yet (D19) | `src/features/optimize/ocr/`: `ocrWorker.ts` (Tesseract Web Worker, per-language worker cache) + `ocrDocument.ts` (per-page pipeline). Skips pages that already have text via `hasTextLayer` (≥20 non-whitespace chars from pdf.js `getTextContent`). Word bboxes normalized 0..1, reusing the `Rect` type — ready for the write-back into an invisible searchable layer, which is a separate, not-started sub-task. Progress contract: skipped pages fire `onProgress` once (`'skipped'`), recognized pages twice (`'recognizing'`, then `'done'`) — confirm this matches expectations before building a progress UI on it. Language models from Tesseract's CDN (D7); worker/wasm engine assets self-hosted via Vite `?url`. Verified 4/4 by a temporary script (text-page skip, recognition accuracy, worker cache hit, progress counts). `shared/lib/pdfjs.ts` changes were additive only (`getTextContent`, `renderPageForOcr`). |

## Group 3: Edit

**Annotate is dropped and deleted, not deferred (R3, 2026-07-20).** Its
nine sub-tools — Shapes, Eraser, Highlight, Add text, Note, Draw, Image,
Sign, Text highlight — are out of scope; don't treat them as planned.
`features/edit/annotate/`, the per-page `Annotation` type and its half of
the bake pipeline no longer exist. Watermark and Page numbers are
unaffected.

| Tool | Status | Notes |
|---|---|---|
| Undo / Redo | Built | Keyboard only (Ctrl+Z / Ctrl+Shift+Z), no toolbar buttons yet. Undoable slice: pages + document marks. |
| Rotate | Built | |
| Add watermark | Built | `features/edit/doc-marks/WatermarkPanel.tsx` — modal panel (Split/Protect pattern), text or image, colour/size/angle/opacity, page range, live page-1 preview. Baked by `annotationBake.ts`. |
| Add page numbers | Built | `features/edit/doc-marks/PageNumbersPanel.tsx` — twin of the above: `{n}`/`{total}` format, corner, margin, size, colour, page range, live preview. |
| Edit text | Not started | pdf.js extract → inline edit → pdf-lib write-back (D6). Logic-first candidate (D19). |
| Crop | Not started | pdf-lib `setCropBox`. Logic-first candidate (D19). |
| PDF Forms | Not started | Fill existing forms; if none, allow creating text field, checkbox, radio, list box, combo box (D10). |

## Group 4: Security

| Feature | Status | Notes |
|---|---|---|
| Unlock existing password | Built | qpdf-wasm decrypt only. `pdfUnlock.ts`, `PasswordPrompt.tsx`, wired in `App.tsx`. |
| Protect PDF (new password) | Logic built, no UI yet (D19) | `src/features/security/protect/protectPdf.ts` — AES-256 via qpdf-wasm, owner password set equal to the user password (D8). Mirrors `pdfUnlock.ts`'s scaffolding (dynamic import, fresh module instance per call, virtual FS). Verified 8/8 by a temporary round-trip script. No `ToolGrid`/`Toolbar`/`App.tsx` changes yet. |

Cross-feature: opening a password-protected file in any tool must prompt
for the password first.

## Out of scope

- Office ↔ PDF conversion (Word/Excel/PowerPoint) — D4
- Redact — D5
- Annotate, all nine sub-tools — R3
- Digital signatures (PKI), mobile QR signing, request-others-to-sign
- User accounts, paid tiers, usage limits

## UX invariants

- Autosave in-progress edits to IndexedDB; recover after reload
- beforeunload warning for unsaved changes
- Consistent hover animation on all enabled buttons
- Long-running operations (OCR, compress) run off the main thread with
  per-item progress

## Known gaps

- D19 batch: Protect PDF and OCR recognition done. Remaining, all
  logic-only with no UI entry point: Crop, PDF Forms, Edit text, OCR
  write-back.

## UI notes

- Tool discovery is the AppBar's "All tools" mega-menu
  (`shared/components/MegaMenu.tsx`, driven by
  `shared/lib/toolCatalog.ts`): a fixed 4-column layout — Organize PDF,
  Optimize PDF, Edit PDF, Security, in that order — so a short category
  never wraps under a taller one. Drops to 2 columns below the `sm`
  breakpoint. Edit PDF holds only Watermark and Page numbers (R3); don't
  pad it out.
