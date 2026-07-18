# PDFdemo — Decisions Log

Design decisions made during development. Reference before proposing
changes that touch these areas — don't re-litigate settled questions.

## Architecture

**D1. Client-side only.** All PDF processing in the browser. No backend,
no database, no server-side file handling. Preserves "files never
uploaded" guarantee, keeps ops cost near zero.

**D2. Feature-based structure with product groupings.** `src/features/
<group>/<module>/`. Group at outer layer mirrors product roadmap; inner
modules split by real code coupling, not by product-name hierarchy.
Example: merge/delete/reorder/rotate share `buildPdf()` and stay
together as `workspace/`, not four separate folders. See architecture.md.

> Precedent: on-demand, one-shot transforms with no ongoing app-state
> involvement get their own feature folder instead of `shared/lib/`,
> even when they reuse `shared/lib/annotationBake.ts`'s drawing
> techniques — e.g. `optimize/ocr/` (`ocrDocument.ts` +
> `bakeOcrTextLayer.ts`) and `edit/edit-text/` (`editText.ts`). They're
> not part of D11's universal `pdfCore.copyPagesToPdf` export pipeline.
> See architecture.md's "planned future groups".

**D3. IndexedDB autosave + beforeunload warning.** In-progress work
survives reload without a server.

## Product scope

**D4. No Office ↔ PDF conversion.** Microsoft already solves this well
for most users. JS-only libraries are too weak; server/API paths break
client-side guarantee. Exception (optional, low priority): PDF ↔ JPG/PNG,
which is easy and high-quality client-side.

**D5. No Redact.** Only feature with intrinsic risk: imperfect
implementation creates false sense of security. Users can visually
cover content with Eraser (white box) or Shapes (black box), but the
UI must state these are visual only and do not remove underlying data.
Recommend Adobe Acrobat Pro for genuine redaction needs.

**D6. Edit Text is in scope.** Ships PDFAid-style: extract text objects
via pdf.js, allow inline editing, write back with pdf-lib. Accept
limitations: font may be substituted, layout may shift with length
changes, scanned PDFs need OCR first. UI must disclose these.

> Implementation note (confirmed decision, not open for
> reconsideration without discussion): edits use the same visual-only
> technique as Eraser (D5) — draw an opaque white cover over the
> original text's region, draw new text on top. The original text's
> operators are NOT removed from the content stream; old text remains
> present/extractable underneath. `editText.ts` exports
> `EDIT_TEXT_DISCLOSURE` for a future UI to surface this, same pattern
> as `OCR_SPEED_DISCLOSURE`.

## Technology

**D7. OCR: Tesseract.js, client-side.** Trade-offs are real (slower,
lower accuracy vs. paid cloud APIs) but preserve the privacy guarantee.
Required implementation details:
- Web Worker to keep the UI thread free
- Lazy per-language model loading; cache after first fetch
- Sequential per-page processing with a progress bar
- Skip OCR for pages that already have a text layer (check per-page,
  not just per-file — mixed documents are common)
- In-UI disclosure of the trade-off before starting

> Implementation note: Tesseract's language model files (`langPath`) are
> fetched from Tesseract's default CDN, not self-hosted like pdf.js's
> worker or qpdf's wasm (which are bundled same-origin via Vite `?url`).
> This is the one intentional network exception per D7 — only language
> model assets, never user file content, ever leave the browser.

**D8. Protect PDF: user password only.** No owner password / permissions.
qpdf-wasm (or equivalent) client-side, AES-256. Any other feature
receiving a password-protected file must prompt for the password first.

> Implementation note: `protectPdf.ts` invokes qpdf as
> `qpdf --encrypt <password> <password> 256 -- in out` — owner password
> is deliberately set equal to the user password, since there's no
> separate owner secret in this product (see D8 above). Any future code
> calling qpdf's encrypt path should follow this same pattern.

**D9. Sign is image-based, not cryptographic.** Three input modes: typed
(with font suggestions), drawn, uploaded image. No PKI / digital
signature, no mobile QR flow, no request-others-to-sign (would require
a backend).

**D10. PDF Forms handles both cases.** If the file has AcroForm fields,
edit them directly. If not, allow the user to create new fields: text
field, checkbox, radio, list box, combo box.

**D11. Edit PDF shares one annotation infrastructure.** All annotation
tools (Add text, Sign, Draw, Shapes, Eraser, Highlight, Image, Note)
plus Watermark and Add page numbers reuse a single "draw object onto
PDF" pipeline. Do not implement them as isolated features.

> Known limitation: `annotationBake.ts`'s normalized-`Rect`-to-pdf-lib-
> point conversion does not correct for a page's intrinsic `/Rotate`
> value. Applies to annotations and to OCR's word boxes (`bakeOcrTextLayer.ts`,
> derived from a rotation-aware rendered viewport). It does NOT apply to
> `editText.ts`: pdf.js's raw text-run coordinates (`getTextContent`)
> are already in the page's unrotated MediaBox space, matching
> `page.view`/pdf-lib's `page.getSize()` directly — confirmed empirically,
> no rotation adjustment needed there. Worth a look whenever
> annotation-authoring UI or OCR UI work touches rotated pages.

## Business model

**D12. Tracking ads (AdSense) are acceptable.** Higher revenue than
non-tracking alternatives, easier to set up. Consequence for
positioning:
- OK to say: "files never uploaded", "100% in your browser", "processed
  on your device"
- Not OK to say: "we don't track you", "fully private", "no tracking"
  — third-party ad network still tracks via cookies/fingerprinting
- Required: cookie banner for EU (GDPR), privacy policy page mentioning
  AdSense, CCPA opt-out for California if applicable

**D13. Free, no accounts, no tiers.** Simplifies operations (no auth,
no DB, no billing). Matches "genuinely free" positioning.

## Development workflow

**D14. Prompts to Claude Code in English.** Higher fidelity than
Vietnamese; more training data, more technical docs in English.

**D15. Bug-fix prompt structure.** Every bug prompt must include:
expected vs. actual, request to identify root cause before patching,
scope limit (no unrelated refactors), specific verification steps.
Common rules live in CLAUDE.md's "Bug Fix Protocol" to avoid repetition.

**D16. Plan Mode for structural changes.** Any change affecting folder
structure, cross-cutting infrastructure, or multiple features starts
in Plan Mode. Review the plan before touching code.

**D17. Git commit checkpoints, split by concern.** Safety commit before
large refactors. Separate commits per logical change (e.g. hygiene fixes
vs. structural moves) so each can be reverted independently.

**D18. `.claude/docs/` tracked in git; `settings.local.json` ignored.**
Docs are shared project knowledge; local settings are per-machine.

**D19. Logic-first, UI-last for this development cycle.** Build
remaining feature logic (pdf-lib operations, data transforms, workers)
before the corresponding UI/toolbar entry points, to avoid reworking
buttons/screens repeatedly as logic changes. Prompts to Claude Code
should scope strictly to logic + types, excluding ToolGrid/Toolbar/
App.tsx wiring and new UI components — except when a tool is inherently
interaction-first (e.g. a canvas-based annotation tool needs a pointer
surface to exist at all); flag and discuss those cases rather than
silently building or silently skipping them.

**D20. Verification scripts for logic depending on bundler-only imports
(Vite `?url` assets, Worker/wasm loaders) must run under plain Node,
re-invoking the underlying call directly instead of importing the TS
module.** ts-node/direct import fails outside Vite's build pipeline.
Learned from `pdfUnlock.ts`/`protectPdf.ts`; confirmed again for OCR and
Edit Text (both `ocrDocument.ts`/`editText.ts` have a real runtime
import chain through `shared/lib/pdfjs.ts`'s Vite-only `?url` asset
import, so their scripts mirror the logic under plain Node). Exception:
`bakeOcrTextLayer.ts` has zero runtime bundler-only dependencies (its
only OCR-feature reference is a type-only import), so its verification
script bundled the real file with esbuild and required it directly
instead — prefer that stronger form whenever a module turns out not to
need the mirroring workaround.

## Reversals (for clarity)

**R1. Edit Text was tentatively dropped, then reinstated.** See D6.
Assessment shifted after confirming PDFAid ships this successfully with
JS-only tooling.

**R2. OCR was briefly assumed dropped in one exchange, but was never
actually dropped.** See D7. Authoritative state: OCR is in scope,
client-side, Tesseract.js.

## Notes

- Claude Code never runs git commands (add/commit/push/branch, etc.) —
  the product owner handles all git/GitHub operations.
- The app's UI shell was redesigned: `AppBar.tsx` (persistent top bar
  with an "All tools" mega-menu) + `BrowseView.tsx` (continuous-scroll
  browsing with a thumbnail sidebar) replaced the old
  Header/Toolbar/ToolGrid and paginated Browse.
