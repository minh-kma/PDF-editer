# PDFdemo — Feature Roadmap

Client-side PDF toolkit. All processing runs in the browser. No backend,
no database, no file uploads. Funded by ads (see decisions.md D12).

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
| OCR | Recognition logic built, no UI yet (D19) | `src/features/optimize/ocr/` — `ocrWorker.ts` (Tesseract Web Worker wrapper, per-language worker cache) + `ocrDocument.ts` (per-page pipeline). Per-page text-layer skip via `hasTextLayer` heuristic (≥20 non-whitespace chars from pdf.js `getTextContent`). Word-level bboxes normalized 0..1, reusing the existing `Rect` type — ready for a future step to bake them into an invisible searchable layer (that write-back step is a separate, still-not-started follow-up). Progress contract: skipped pages fire `onProgress` once (`'skipped'`); recognized pages fire twice (`'recognizing'` then `'done'`) since recognition can take seconds — confirm this matches expectations before building a progress UI on top of it. Language model files fetched from Tesseract's CDN (the one intentional network exception, see decisions.md D7 addendum); worker/wasm engine assets self-hosted via Vite `?url` like pdf.js/qpdf. Verified via a temporary script, 4/4 checks passed (text-page skip, image-page recognition accuracy, language-worker cache hit, progress-call counts). `shared/lib/pdfjs.ts` got additive-only changes (`getTextContent`, `renderPageForOcr`); no existing export's behavior changed. |

## Group 3: Edit

Toolbar tools (shared annotation infrastructure):

| Tool | Status | Notes |
|---|---|---|
| Undo / Redo | Built | Keyboard-only (Ctrl+Z / Ctrl+Shift+Z), no toolbar buttons yet. Works for Organize actions today; already wired for annotation actions too, pending authoring UI below. |
| Add text | Data model + bake pipeline built, no authoring UI | Font, size, color pickers |
| Edit text | Not started | PDFAid-style: extract text objects, inline edit, accept font substitution. Logic-first candidate (D19). |
| Sign | Data model + bake pipeline built, no authoring UI | Typed (font suggestions), drawn, or uploaded image. Not digital signature. |
| Draw | Data model + bake pipeline built, no authoring UI | Freehand |
| Shapes | Data model + bake pipeline built, no authoring UI | Line / Arrow / Box / Circle — grouped dropdown |
| Eraser | Data model + bake pipeline built, no authoring UI | White box overlay (visual only, does not remove underlying data) |
| Highlight | Data model + bake pipeline built, no authoring UI | Arbitrary region |
| Text highlight | Data model + bake pipeline built, no authoring UI | Existing text via pdf.js text layer |
| Image | Data model + bake pipeline built, no authoring UI | Insert image |
| Note | Data model + bake pipeline built, no authoring UI | Sticky note |

Page-level tools:

| Tool | Status | Notes |
|---|---|---|
| Rotate | Built | |
| Add page numbers | Data model + bake pipeline built, no authoring UI | Position, font, format |
| Add watermark | Data model + bake pipeline built, no authoring UI | Text or image |
| Crop | Not started | Uses pdf-lib setCropBox. Logic-first candidate (D19). |
| PDF Forms | Not started | Fill existing forms. If none present, allow creating: text field, checkbox, radio, list box, combo box. |

## Group 4: Security

| Feature | Status | Notes |
|---|---|---|
| Unlock existing password (prompt-before-proceeding) | Built | qpdf-wasm decrypt only. `pdfUnlock.ts`, `PasswordPrompt.tsx`, wired in `App.tsx`. |
| Protect PDF (create new password) | Logic built, no UI yet (D19) | `src/features/security/protect/protectPdf.ts`. AES-256 via qpdf-wasm, owner password set equal to user password (single secret — see decisions.md D8 addendum). Mirrors `pdfUnlock.ts`'s scaffolding (dynamic import, fresh module instance per call, virtual FS). Verified via a temporary round-trip script, 8/8 checks passed. No `ToolGrid`/`Toolbar`/`App.tsx` changes yet. |

Cross-feature: opening a password-protected file in any tool must prompt
for the password before proceeding.

## Out of scope

- Office ↔ PDF conversion (Word/Excel/PowerPoint)
- Redact
- Digital signatures (PKI), mobile QR signing, request-others-to-sign
- User accounts, paid tiers, usage limits

## UX invariants

- Autosave in-progress edits to IndexedDB; recover after reload
- beforeunload warning for unsaved changes
- Consistent hover animation on all enabled buttons
- Long-running operations (OCR, compress) must run off the main thread
  and show per-item progress

## Known gaps

- `ToolGrid.tsx` (landing tool catalog) only lists Organize + Optimize
  categories — Edit and Security have zero user-facing entry points, even
  for Rotate/Unlock which are otherwise fully built. Intentional for now
  — UI wiring is deferred to a dedicated pass per D19.
- The Edit group is backend-complete, UI-absent: annotation data model
  (D11 discriminated union), undo/redo wiring, and the bake pipeline
  (`annotationBake.ts`) are all done, but no component anywhere creates
  an `Annotation` or `DocAnnotation` — no toolbar buttons, no canvas
  overlay, no pickers. Per D19 this authoring-UI investment is
  deliberately deferred until the logic-first batch (OCR write-back,
  Crop, PDF Forms, Edit text) is done.
- Logic-first batch progress (D19): Protect PDF done; OCR recognition
  done (write-back of recognized text into an invisible searchable PDF
  layer is a separate remaining sub-task). Remaining: Crop, PDF Forms,
  Edit text, OCR write-back.
