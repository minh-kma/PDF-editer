# PDF Processing

All PDF work runs in the browser. Two libraries with strictly separated roles:

| Library | Role | Where |
|---|---|---|
| **pdf-lib** | Editing: create/copy pages, rotate, save bytes | `features/page-management/**/*.ts`, `shared/lib/pdfCore.ts` |
| **pdfjs-dist** (pdf.js) | Rendering only: thumbnails and previews | `shared/lib/pdfjs.ts`, `shared/lib/thumbnails.ts` |

Never use pdf.js to modify a document or pdf-lib to render one.

## The page plan → bytes model

Edits never touch the original bytes. The store holds `SourceDoc[]` (original
uploaded bytes, untouched) and an ordered `PageItem[]` plan (each item:
`sourceId`, 0-based `sourceIndex`, user `rotation` 0/90/180/270). Output bytes
are produced on demand by the three operations below, all of which walk the
plan and copy pages out of the sources.

## Operations

### `shared/lib/pdfCore.ts` — `loadSources(sources, neededIds)`
Parses each needed source once into a `Map<sourceId, PDFDocument>`. Shared by
`buildPdf` and `splitPdf`. Note it loads from `s.bytes.slice()` — see
"Buffer ownership" below.

### `features/page-management/workspace/buildPdf.ts` — `buildPdf(sources, pages)`
Merge/delete/reorder/rotate all collapse into this one function: create an
empty `PDFDocument`, copy pages one at a time in plan order (per-page copying
is intentional — batch copy would lose the user's ordering), apply
`page.rotation` on top of the page's intrinsic rotation (`(current + delta) % 360`),
return `out.save()`.

### `features/page-management/split/splitPdf.ts` — `splitPdf(sources, pages, ranges, baseName)`
Same copy loop, but once per `SplitRange` (1-based, inclusive, positions in
the *plan*, i.e. after reordering). Returns named parts
(`{base}_part{N}_p{start}-{end}.pdf`). `SplitPanel.tsx` zips the parts with
JSZip and downloads `{base}_split.zip`. Range parsing/validation
(`buildRanges`) lives in `SplitPanel.tsx`.

### `features/page-management/compress/compressPdf.ts` — `compressPdf(bytes)`
Lossless re-save with `{ useObjectStreams: true, addDefaultPage: false }`.
Caller (`App.tsx` `handleCompress`) compares sizes and **keeps whichever is
smaller** — output must never be larger than input. UI shows honest
before/after numbers. Do not add lossy compression without explicit approval.

## Rendering & caching

- `shared/lib/pdfjs.ts`: pdf.js worker is bundled via
  `pdfjs-dist/build/pdf.worker.min.mjs?url` (Vite asset URL). Parsed docs are
  cached in a module-level `Map<sourceId, Promise<PDFDocumentProxy>>` outside
  React. Call `forgetDoc(sourceId)` if a source is discarded. `renderPage`
  draws one page to a canvas → PNG data URL.
- `shared/lib/thumbnails.ts`: memoizes data URLs keyed by
  `sourceId:sourceIndex:rotation` at width 200px. Rotation is in the key, so
  rotating a page naturally invalidates its thumbnail.

## Buffer ownership (common pitfall)

Both pdf.js and pdf-lib can **detach or take over** an `ArrayBuffer` they are
handed. Every call site therefore passes `bytes.slice()` (a private copy) and
keeps the store's original `SourceDoc.bytes` pristine. `downloadPdf` also
copies before creating the Blob. Preserve this pattern in any new code —
passing store bytes directly will corrupt state in subtle ways.

## Download

`shared/lib/download.ts`: `downloadBlob` (object URL + synthetic `<a>` click,
URL revoked after 1s) and `downloadPdf` (wraps bytes in a Blob). Downloads are
only triggered from the preview modal or the split panel — never automatically.
