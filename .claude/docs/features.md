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
| Extract pages | Planned |

## Group 2: Optimize

| Feature | Status | Notes |
|---|---|---|
| Compress | Built | |
| OCR | Planned | Tesseract.js in Web Worker. Per-language model, lazy-loaded + cached. Per-page progress. Auto-detect existing text layer (per-page, not per-file) to skip unnecessary OCR. |

## Group 3: Edit

Toolbar tools (shared annotation infrastructure):

| Tool | Notes |
|---|---|
| Undo / Redo | |
| Add text | Font, size, color pickers |
| Edit text | PDFAid-style: extract text objects, inline edit, accept font substitution |
| Sign | Typed (font suggestions), drawn, or uploaded image. Not digital signature. |
| Draw | Freehand |
| Shapes | Line / Arrow / Box / Circle — grouped dropdown |
| Eraser | White box overlay (visual only, does not remove underlying data) |
| Highlight | Arbitrary region |
| Text highlight | Existing text via pdf.js text layer |
| Image | Insert image |
| Note | Sticky note |

Page-level tools:

| Tool | Status | Notes |
|---|---|---|
| Rotate | Built | |
| Add page numbers | Planned | Position, font, format |
| Add watermark | Planned | Text or image |
| Crop | Planned | Uses pdf-lib setCropBox |
| PDF Forms | Planned | Fill existing forms. If none present, allow creating: text field, checkbox, radio, list box, combo box. |

## Group 4: Security

| Feature | Status | Notes |
|---|---|---|
| Protect PDF | Planned | User password only. AES-256 via qpdf-wasm or equivalent. No permissions/owner-password complexity. |

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