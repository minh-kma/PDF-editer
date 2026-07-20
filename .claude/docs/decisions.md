# PDFdemo — Decisions Log

Settled decisions. Read before proposing changes in these areas; don't
re-litigate. Superseded entries stay in place, marked with the reversal
that changed them.

## Architecture

**D1. Client-side only.** All PDF processing in the browser — no backend,
database, or server-side file handling. Preserves the "files never
uploaded" guarantee and keeps ops cost near zero.

**D2. Feature-based structure with product groupings.**
`src/features/<group>/<module>/`. Groups mirror the product roadmap;
modules split by real code coupling, not product naming —
merge/delete/reorder/rotate share `buildPdf()` so they stay one
`workspace/` module, not four. Precedent: OCR gets its own `optimize/`
folder (not `page-management/`, where Compress lives) because it works
on raw bytes via pdf.js + Tesseract, not the page plan. See
architecture.md.

**D3. IndexedDB autosave + beforeunload warning.** In-progress work
survives reload without a server.

## Product scope

**D4. No Office ↔ PDF conversion.** JS-only libraries are too weak;
server/API paths would break D1. Optional low-priority exception:
PDF ↔ JPG/PNG, which is easy and high-quality client-side. The
images-to-PDF half of that exception is now built —
`features/convert/images-to-pdf/`, PNG + JPEG in (exactly what pdf-lib
embeds natively), PDF out. The reverse direction, PDF → JPG/PNG, is
still unbuilt. The Office rule itself is unchanged.

**D5. No Redact.** The one feature with intrinsic risk — imperfect
redaction creates a false sense of security. Recommend Adobe Acrobat Pro
for genuine needs. (The Eraser/Shapes visual cover-up workaround this
originally pointed to no longer exists — see R3.)

**D6. Edit Text is in scope.** PDFAid-style: extract text objects via
pdf.js, inline edit, write back with pdf-lib. UI must disclose the
limits: font may be substituted, layout may shift when length changes,
scanned PDFs need OCR first. See R1.

## Technology

**D7. OCR: Tesseract.js, client-side.** Slower and less accurate than
paid cloud APIs, but preserves the privacy guarantee. Required: Web
Worker; lazy per-language model loading, cached after first fetch;
sequential per-page processing with a progress bar; skip pages that
already have a text layer (check per page, not per file — mixed
documents are common); disclose the trade-off in-UI before starting.
Language model files (`langPath`) come from Tesseract's CDN — the one
intentional network exception, and only model assets, never user file
content. pdf.js's worker and qpdf's wasm stay same-origin via Vite
`?url`. See R2.

**D8. Protect PDF: user password only.** No owner password or
permissions. qpdf-wasm client-side, AES-256. Any feature receiving a
password-protected file must prompt for the password first.
`protectPdf.ts` calls `qpdf --encrypt <password> <password> 256 -- in
out` — owner password is deliberately set equal to the user password
since there's no separate owner secret; follow this pattern for any
future qpdf encrypt call.

**D9. Sign is image-based, not cryptographic.** Three input modes: typed
(with font suggestions), drawn, uploaded image. No PKI/digital signature,
no mobile QR flow, no request-others-to-sign (would need a backend).
Currently moot — Sign was one of the nine tools dropped by R3; kept on
record in case it returns as a standalone tool.

**D10. PDF Forms handles both cases.** Edit existing AcroForm fields
directly; if the file has none, allow creating them: text field,
checkbox, radio, list box, combo box.

**D11. One shared "draw object onto PDF" pipeline.**
`shared/lib/annotationBake.ts`, reached only via
`pdfCore.copyPagesToPdf`. Never implement a page-drawing tool as an
isolated feature. Partly superseded by R3: the nine per-page annotation
tools and the `Annotation` discriminated union are gone, so the rule now
binds Watermark, Page numbers, and any future page-drawing tool.

## Business model

**D12. Tracking ads (AdSense) are acceptable.** Higher revenue and easier
setup than non-tracking alternatives. Positioning consequences — OK to
say: "files never uploaded", "100% in your browser", "processed on your
device". Not OK: "we don't track you", "fully private", "no tracking"
(the ad network still tracks via cookies/fingerprinting). Required: EU
cookie banner (GDPR), privacy policy naming AdSense, CCPA opt-out for
California if applicable.

**D13. Free, no accounts, no tiers.** No auth, DB, or billing; matches
the "genuinely free" positioning.

## Development workflow

**D14. Prompts to Claude Code in English.** Higher fidelity than
Vietnamese — more training data and technical docs.

**D15. Bug-fix prompt structure.** Every bug prompt states expected vs.
actual, asks for root cause before patching, limits scope (no unrelated
refactors), and lists verification steps. Common rules live in
CLAUDE.md's "Bug Fix Protocol" to avoid repetition.

**D16. Plan Mode for structural changes.** Anything affecting folder
structure, cross-cutting infrastructure, or multiple features starts in
Plan Mode; review the plan before touching code.

**D17. Git commit checkpoints, split by concern.** Safety commit before
large refactors; one commit per logical change (e.g. hygiene fixes vs.
structural moves) so each reverts independently. Performed by the
product owner — see D21.

**D18. `.claude/docs/` tracked in git; `settings.local.json` ignored.**
Docs are shared project knowledge; local settings are per-machine.

**D19. Logic-first, UI-last for this development cycle.** Build feature
logic (pdf-lib operations, data transforms, workers) before the matching
UI/toolbar entry point, to avoid reworking screens as logic changes.
Prompts scope strictly to logic + types, excluding ToolGrid/Toolbar/
App.tsx wiring and new UI components — flag interaction-first tools for
discussion rather than silently building or skipping them. (Its named
exception, canvas-based annotation tools, has no subject after R3.)

**D20. Verification scripts for logic depending on bundler-only imports
must run under plain Node**, re-invoking the underlying call directly
instead of importing the TS module — ts-node/direct import fails outside
Vite's pipeline. Applies to Vite `?url` assets and Worker/wasm loaders.
Learned from `pdfUnlock.ts`/`protectPdf.ts`; for OCR the mirrored script
could run functionally in Node (tesseract.js has a Node backend,
pdfjs-dist ships a Node build), but a temporary Vite entry was still
needed to confirm the `?url` worker/wasm assets actually bundle, since
`npm run build` doesn't touch UI-unwired code.

**D21. Claude Code never runs git.** No `add`, `commit`, `push`,
`branch`, `checkout`, `reset`, `merge`, or `tag` — the product owner
performs every git operation. Read-only inspection (`status`, `diff`,
`log`) is fine when explicitly asked for.

**D22. Compress recompresses images by object-layer substitution, not by
a page-copy pipeline.** pdf-lib's `embedJpg`/`embedPng` only ADD a new
image to a document; they cannot swap one that existing page content
already draws. So `recompressImages.ts` works at the object layer:
`context.enumerateIndirectObjects()` → find `PDFRawStream`s with
`/Subtype /Image` → decode → re-encode via canvas →
`context.assign(ref, PDFRawStream.of(dict, jpeg))` onto the **same
`PDFRef`**. Because the ref is unchanged, every page that draws the image
keeps working with no page copying and no resource-dictionary rewriting.
A copy pipeline was considered and rejected: it would risk the
shared-resource duplication that already forces the `pristine`/`baseline`
fallback in the compress flow, and would need `pdfCore.copyPagesToPdf`
(shared with build/split/extract) to grow a hook nothing else uses.

Only raster image XObjects are ever assigned over, so non-image content
is untouchable by construction. Images with `/SMask`, `/Mask` or
`/ImageMask` are skipped entirely — JPEG has no alpha channel and
flattening a cut-out logo onto white visibly wrecks it. Also skipped:
JPXDecode (browsers can't decode it), bitonal/CCITT/JBIG2 (already
smaller than any JPEG we'd produce), Indexed/CMYK/Separation (colour
would shift), filter chains, and anything under 64px or 16KB.

Levels are quality + a DPI cap, applied together: Low 0.82/220,
Medium 0.65/150 (default), High 0.45/110. 150 DPI matches Ghostscript's
`/ebook` and Acrobat's screen preset. Low caps at 220 rather than 300 on
purpose — a level that visibly does nothing to an ordinary 300 DPI scan
reads as broken. Displayed resolution is estimated as "the image spans
the widest page that references it", which is near-exact for scans and
under-estimates DPI for small logos, i.e. it errs toward downsampling
less. Verified against pdf-lib 1.17.1 under plain Node per D20.

## Reversals

**R1. Edit Text was dropped, then reinstated.** See D6 — assessment
shifted after confirming PDFAid ships this with JS-only tooling.

**R2. OCR was briefly assumed dropped, but never actually was.** See D7.
Authoritative state: in scope, client-side, Tesseract.js.

**R3. Annotate was designed, partly built, then dropped (2026-07-20).**
All nine sub-tools — Shapes, Eraser, Highlight, Add text, Note, Draw,
Image, Sign, Text highlight — plus their shared authoring infrastructure
are out of scope and deleted, not deferred. The approved build-out plan
(`cozy-crunching-platypus.md`) is abandoned for the Annotate portion and
must not be resumed or cited for Annotate work.

Removed: all of `features/edit/annotate/` (~1,076 lines —
`AnnotationUIContext`, `AnnotationToolbar`, `AnnotationOverlay`,
`AnnotationFrame`, `ShapesSubToolbar`, drag/rotation coordinate helpers,
per-type visuals), the `annotate` mode in `App.tsx`, `BrowseView`'s
`renderPageOverlay` prop, the per-page `Annotation` union with its
reducer actions and autosave field, and the `drawAnnotation` half of the
bake pipeline. More had been built than features.md previously claimed:
the full authoring layer for Shapes + Eraser existed.

Affects D5, D9, D11 and D19 — noted at each; all four keep their
substance. Watermark and Page numbers are explicitly NOT part of this
reversal: their panels moved to `features/edit/doc-marks/`, and the
`DocAnnotation` model, `docAnnotations` store slice and bake pipeline are
unchanged in behaviour.

**R4. Compress was lossless-only; it is now lossy by user choice
(2026-07-21).** The original rule — "Compress must stay lossless and
honest: keep whichever output is smaller, never make the file bigger" —
is half-reversed by the product owner.

Why: the lossless implementation was a two-line re-save with object
streams. That rewrites the PDF's bookkeeping (cross-reference tables,
object headers, unreferenced objects) and leaves every content stream
byte-identical — including the embedded JPEGs that are 95%+ of a scan.
So on exactly the files people want to shrink, it saved ~nothing, and
the safety net usually handed the original file straight back. The tool
was honest but useless.

What changed: quality loss is now accepted, chosen explicitly by the
user via Low/Medium/High (see D22). What did NOT change: the
before/after display, and the **never make the file bigger** floor,
which now holds at two levels — a re-encoded image that isn't smaller
keeps its original stream, and a document that isn't smaller is
discarded in favour of the baseline. Quality loss is a deliberate trade;
a size increase never is.

Consequences: `compressPdf` gained a level argument and moved its work
into a Web Worker (`compressWorker.ts`) with per-image progress, which
makes the long-standing features.md UX invariant true for compress for
the first time. Compress stopped being a one-shot action and became a
modal panel (`CompressPanel.tsx`), taking the before/after and
`pristine`/`baseline` logic out of `App.tsx` with it. CLAUDE.md's Key
Constraints bullet and the mega-menu's "losslessly" description were
both rewritten — they had become false.
