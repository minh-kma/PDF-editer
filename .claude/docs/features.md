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
| Compress | Built | `src/features/page-management/compress/`: `CompressPanel.tsx` (level picker + progress), `compressPdf.ts` (worker driver + lossless fallback), `compressWorker.ts`, `recompressImages.ts` (the image pass). **Lossy by user choice — R4/D22.** Recompresses embedded raster images (Low 0.82 quality/220 DPI, Medium 0.65/150 default, High 0.45/110) and re-saves with object streams; text, vectors and fonts are never touched. Images with transparency, JPEG 2000, bitonal/CCITT/JBIG2, Indexed/CMYK, filter chains, and anything under 64px or 16KB are skipped. Never ships a bigger file: per-image (a re-encode that isn't smaller is discarded) and per-document (the `pristine`/`baseline` comparison). Runs in a Web Worker with per-image progress; falls back to the lossless re-save where `OffscreenCanvas.convertToBlob` is missing (Safari < 16.4), saying so in the result. |
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

## Group 5: Convert

| Feature | Status | Notes |
|---|---|---|
| Images to PDF | Built | `src/features/convert/images-to-pdf/` — `imagesToPdf.ts` (logic) + `ImagesToPdfView.tsx` / `ImageCard.tsx` / `ImageZoom.tsx` / `useImageList.ts`. PNG + JPEG only, sniffed from magic bytes (D4). Dashed drop area wrapping a dnd-kit reorderable thumbnail grid; per-image rotate left/right, enlarge, remove; sort by name A→Z / Z→A (numeric-aware, so `img2` precedes `img10`). Options: Merge (default on), page size `Fit to image / A4 (default) / Letter / Legal / A3 / A5`, orientation `Auto (default) / Portrait / Landscape` (disabled for Fit to image), margin `No margin (default, 0pt) / Small (18pt) / Big (36pt)`. Merge on → one PDF via the preview modal; merge off → one PDF per image, previewing the first and downloading all as `PDFdemo_images.zip` (PreviewModal's `onDownload`/`downloadLabel` props). **Fit to image maps 1px → 1pt but caps the longer edge at 2384pt (A0's short side, 33.1in), scaling down proportionally** — never cropped or stretched; well inside PDF's ~14400pt per-page maximum. One-shot tool: module-local state, no IndexedDB autosave, no undo/redo, and it never touches the page plan — an open PDF session survives switching in and out. |
| PDF to images | Not started | The reverse half of D4's exception. |

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
- Every UI string is bilingual (English/Vietnamese) via `t()`; the
  language switcher sits in the AppBar and the choice persists in
  localStorage (D23)

## Known gaps

- D19 batch: Protect PDF and OCR recognition done. Remaining, all
  logic-only with no UI entry point: Crop, PDF Forms, Edit text, OCR
  write-back.
- **The Vietnamese copy is a Claude-drafted first pass and has not been
  reviewed by a native speaker.** All ~400 strings need a tone/naturalness
  check by the product owner before the bilingual UI counts as done
  (D23) — particularly tool names, which are sometimes conventionally
  left in English in Vietnamese software.
- `EDIT_TEXT_DISCLOSURE` in `features/edit/edit-text/editText.ts` is the
  only user-facing string still hard-coded in English, deliberately: Edit
  text has no UI yet, so there is nothing rendering it. Move it into an
  `editText` locale namespace when that UI is built.

## UI notes

- Tool discovery is the AppBar's "All tools" mega-menu
  (`shared/components/MegaMenu.tsx`, driven by
  `shared/lib/toolCatalog.ts`): a fixed 5-column layout — Organize PDF,
  Optimize PDF, Edit PDF, Security, Convert, in that order — so a short
  category never wraps under a taller one. Panel is `min(92vw, 46rem)`,
  dropping to 2 columns below the `sm` breakpoint. Edit PDF holds only
  Watermark and Page numbers (R3) and Convert only Images to PDF; don't
  pad either out.
- Every tool except Images to PDF assumes a PDF is already loaded, and
  `App.handleToolSelect` forces a file picker when none is. Images to PDF
  brings its own images, so it returns early *before* that check and takes
  over the main content area as its own `MainMode`.
