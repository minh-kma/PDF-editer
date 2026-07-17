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
`sourceId`, 0-based `sourceIndex`, user `rotation` 0/90/180/270). Edit-group
tools add **annotations** on top (see "Annotations & the bake pipeline"). Output
bytes are produced on demand by the three operations below, all of which walk
the plan and copy pages out of the sources.

## Operations

### `shared/lib/pdfCore.ts` — `loadSources` + `copyPagesToPdf`
`loadSources(sources, neededIds)` parses each needed source once into a
`Map<sourceId, PDFDocument>` from `s.bytes.slice()` (see "Buffer ownership").
`copyPagesToPdf(loaded, items, bake?)` is **the single chokepoint** that copies
pages one at a time in plan order (per-page copying is intentional — batch copy
would lose the user's ordering), applies `page.rotation` on top of the page's
intrinsic rotation (`(current + delta) % 360`), bakes annotations when a `bake`
arg is passed, and returns `out.save()`. `buildPdf`, `splitPdf` and `extractPdf`
all funnel through it, so page-copy + annotation baking live in exactly one
place.

### `features/page-management/workspace/buildPdf.ts` — `buildPdf(sources, pages, bake?)`
Merge/delete/reorder/rotate collapse into this: `loadSources` → `copyPagesToPdf`.
Pass `bake` (a `BakeInput`) to draw annotations; omit it for a plain assembly.

### `features/page-management/split/splitPdf.ts` — `splitPdf(…, bake?)` and `extractPdf(…, bake?)`
`splitPdf(sources, pages, ranges, baseName, bake?)` calls `copyPagesToPdf` once
per `SplitRange` (1-based, inclusive, positions in the *plan*), returning named
parts (`{base}_part{N}_p{start}-{end}.pdf`); `SplitPanel.tsx` zips them with
JSZip → `{base}_split.zip`. `extractPdf(sources, pages, positions, bake?)` calls
it once for the selected 1-based positions, in the order given, returning one
PDF's bytes (`ExtractPanel.tsx` routes it through the preview modal). Range
parsing (`buildRanges`) lives in `SplitPanel.tsx`.

## Annotations & the bake pipeline

The Edit group layers annotations onto the plan (decision **D11**: one shared
"draw object onto PDF" pipeline for all ~15 tools). See the Edit-group state
model plan for the data shapes.

- **State (`shared/state/types.ts`, `store.tsx`):** one generic `Annotation`
  discriminated union (`text`/`freehand`/`shape`/`highlight`/`textHighlight`/
  `image`/`note` — eraser is a white `shape` box, sign is `image`/`text`), kept
  per page in `annotations: Record<PageItem.id, Annotation[]>`, plus
  `docAnnotations` (watermark / page numbers) and an `assets` map (image bytes,
  keyed by content hash, referenced by `assetId`). Coordinates are normalized
  0..1, top-left origin, relative to the page's *unrotated* crop box.
- **Bake (`shared/lib/annotationBake.ts`):** `createBakeSession` + `bakePage`
  are the only place annotations become PDF marks (pdf-lib
  `drawText/drawLine/drawRectangle/drawEllipse/drawImage`). Normalized→points
  conversion and per-doc font/image embedding live here. `copyPagesToPdf` calls
  it per output page; a `BakeInput` is `{ annotations, docAnnotations, assets }`.
- **pdf-lib edits, pdf.js draws** still holds — annotations are baked with
  pdf-lib at export; the (future) interactive overlay renders them as a DOM
  layer, so the pdf.js thumbnail cache key is unchanged.

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
