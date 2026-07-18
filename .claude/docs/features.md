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
| OCR | Logic complete (recognition + write-back), no UI yet (D19) | `src/features/optimize/ocr/`: `ocrWorker.ts` + `ocrDocument.ts` (recognition, per-page skip, word bboxes) and `bakeOcrTextLayer.ts` (write-back — invisible searchable text layer via pdf-lib). Verified: recognized pages become genuinely searchable, skipped pages untouched, page count/dimensions preserved. Only remaining work: ToolGrid/Toolbar entry, a "Run OCR" trigger chaining `ocrDocument()` → `bakeOcrTextLayer()`, and a progress bar. |

## Group 3: Edit

Toolbar tools (shared annotation infrastructure):

| Tool | Status | Notes |
|---|---|---|
| Undo / Redo | Built | Keyboard-only (Ctrl+Z / Ctrl+Shift+Z), no toolbar buttons yet. Works for Organize actions today; already wired for annotation actions too, pending authoring UI below. |
| Add text | Data model + bake pipeline built, no authoring UI | Font, size, color pickers |
| Edit text | Logic built, no UI yet (D19) | `src/features/edit/edit-text/editText.ts`: `extractEditableText` (read-only, per-run text + rect + font size via pdf.js) and `applyTextEdits` (draws an opaque white cover + new text on top, reusing Eraser's cover technique and Add-text's font loading from `annotationBake.ts`). Confirmed design: visual-only, same as Eraser (D5) — original text is NOT removed from the content stream and remains extractable; `EDIT_TEXT_DISCLOSURE` exported for a future UI. Verified: new text present after edit, old text also still present (expected, not a bug), page count/dimensions unchanged, new text uses normal (non-invisible) rendering. Only remaining work: click-to-edit overlay UI. |
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
| Crop | Logic complete, no UI yet (D19) | `src/features/edit/crop/cropPages.ts` (95 lines): `setCropBox` per page, degenerate-rect/no-overlap validation, per-page applied/failed results. |
| PDF Forms | Logic complete, no UI yet (D19) | `src/features/edit/forms/formFields.ts`: `extractFormFields`/`fillFormFields` (read/fill existing AcroForm fields) plus `createFormFields` (new text field, checkbox, radio, list box, combo box) — both halves of D10 done. |

## Group 4: Security

| Feature | Status | Notes |
|---|---|---|
| Unlock existing password (prompt-before-proceeding) | Built | qpdf-wasm decrypt only. `pdfUnlock.ts`, `PasswordPrompt.tsx`, wired in `App.tsx`. |
| Protect PDF (create new password) | Logic built, no UI yet (D19) | `src/features/security/protect/protectPdf.ts`. AES-256 via qpdf-wasm, owner password set equal to user password (single secret — see decisions.md D8 addendum). Verified via a temporary round-trip script, 8/8 checks passed. No `ToolGrid`/`Toolbar`/`App.tsx` changes yet. |

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

- `toolCatalog.ts`'s `TOOL_CATEGORIES` (consumed by the persistent bar's
  `MegaMenu.tsx`) only lists Organize + Optimize categories — Edit and
  Security have zero user-facing entry points, even for Rotate/Unlock which
  are otherwise fully built. Intentional for now — UI wiring is deferred to
  a dedicated pass per D19.
- The Edit group is backend-complete, UI-absent for its annotation tools:
  data model (D11 discriminated union), undo/redo wiring, and the bake
  pipeline (`annotationBake.ts`) are all done, but no component anywhere
  creates an `Annotation`/`DocAnnotation` — no toolbar buttons, no canvas
  overlay, no pickers. Per D19 this authoring-UI investment is
  deliberately deferred until the logic-first batch (Crop, PDF Forms) is
  done.
- Logic-first batch progress (D19): all done — Protect PDF, OCR
  (recognition + write-back), Edit text, PDF Forms (read/fill + create
  fields), and Crop (`setCropBox`). Nothing logic-side remains; only UI
  wiring is left for the whole batch.
