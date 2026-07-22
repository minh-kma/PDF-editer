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

**D23. Bilingual UI (English/Vietnamese) via react-i18next, fully
bundled.** `i18next` + `react-i18next` +
`i18next-browser-languagedetector`, initialised in `shared/i18n/index.ts`
and imported for side effects in `main.tsx` — no provider and no Suspense
boundary, because resources are static imports and therefore synchronous.
**No `i18next-http-backend` and no CDN**: locale data is bundled like
every other asset, so the app stays offline-capable (verified in `dist/`:
Vietnamese strings are inlined in the main chunk, with no separate locale
chunk and no `loadPath` reference).

Detection is `localStorage` → `navigator`, key `pdfdemo:lang` (matching
storage.ts's convention), so an explicit toggle beats the browser locale
on later visits. (The key is now written by the switcher alone rather
than by i18next's detector cache — see D26.) `load: 'languageOnly'`
maps any `vi-*` tag onto `vi`; anything unsupported falls back to `en`.
The key is deliberately in localStorage rather than the IndexedDB session
store, so the preference survives "Start over" and `clearSession()`.

Locale files are centralised in `shared/i18n/locales/<lang>/` as 11
namespaces mirroring the feature modules, NOT co-located with each
feature — co-location would force `shared/` to import from `features/`,
inverting the module dependency direction (see architecture.md).
`i18next.d.ts` types `t()` against the English resources so missing or
misspelled keys fail the typecheck; this caught a real error during
implementation (a namespace-scoped `t` cannot take a `ns:key` prefix —
request the array form instead).

Logic modules never import i18n (Workers have no React context; D19 keeps
logic UI-free). They throw English `Error`s as developer diagnostics, and
the UI maps them to translated messages — **`err.message` is never
rendered to the user any more**, which was the practice throughout
`App.tsx` before this change. Typed error classes
(`WrongPasswordError`, `AlreadyEncryptedError`, `EmptyPasswordError`)
remain the contract and are mapped by class at the UI boundary.

Never translated: the **PDFdemo** brand, user-authored content (watermark
text, uploaded file names), and generated filename suffixes
(`_edited`, `_compressed`, …), which stay ASCII English by product
decision. One deliberate exception sits on that boundary: Page numbers'
third *Style* option is not a UI label — the picked string is stored on
the `DocAnnotation` and printed into the output PDF — so it follows the
UI language (`Trang {n} / {total}` in Vietnamese) and is then stored
verbatim, never re-translated. The `{n}`/`{total}` tokens are safe
because i18next interpolates `{{…}}`, not single braces.

Implemented in three sequential passes (plumbing + shared components →
tool panels → errors/toasts/docs) so a wrong convention couldn't be
replicated across 35 files before review.

**D24. The app is PDFChill, and every colour comes from three Tailwind
theme tokens (2026-07-21).** The product owner renamed PDFdemo →
**PDFChill** (one word, that exact casing) and replaced the warm
coral/cream palette with the teal/blue one specified in
`reference_photos/pdfchill-logo.pdf` and
`reference_photos/pdfchill-website-mockup.pdf`.

Colour lives **only** in `tailwind.config.js`, as `brand` (teal 50–900,
500 = `#006c76`), `surface` (page/card/inset backgrounds; formerly named
`cream`, renamed because the old name described the old palette) and
`ink` (text). No component hard-codes a brand colour, and no raw Tailwind
palette class (`bg-rose-500` and friends) is used for brand intent — the
only literal colours left in components are `red-*` for errors/destructive
actions and neutral `#666`/`#888` defaults for *user-authored* annotation
content, which are not brand colours. Re-theming is therefore a
one-file edit; keep it that way.

The logo is `LogoMark` in `shared/components/icons.tsx` — an inline SVG
following the existing hand-drawn-icon convention, but deliberately
self-coloured rather than `currentColor`, since it *is* the brand mark.
Its geometry and colours (`#006c76` badge, `#ebddb9` wave, upper stroke
at reduced opacity) are traced from the vector data in the logo PDF.
`public/favicon.svg` is the same artwork and must be updated with it.

Two `pdfdemo:` **storage keys were deliberately not renamed**
(`pdfdemo:session:v2` in `storage.ts`, `pdfdemo:lang` in `i18n/index.ts`).
They are invisible to users, and renaming them would silently throw away
every existing user's autosaved session and language preference. Rename
them only alongside a migration.

**D25. Homepage SEO localization: two static HTML entry points, one shared
bundle, path-driven initial language (2026-07-22).** The site served one URL
for both languages, with the UI language chosen at runtime
(`localStorage` → `navigator`). A Vietnamese visitor saw Vietnamese UI, but
Google's crawler — with no browser locale — only ever saw and indexed the
English page, and with one URL there was no way for a Vietnamese search result
to exist. Competitors (Smallpdf) solve this with a `/vi` path.

Approach, scoped to the **homepage route only** (every in-app tool screen keeps
the runtime-only switch, unchanged):

- **Two static HTML entries, one JS/CSS bundle.** `vite.config.ts` gains
  `build.rollupOptions.input = { main: 'index.html', vi: 'vi/index.html' }`.
  Both HTML files load the same `/src/main.tsx`, so Rollup emits **one** shared
  hashed bundle that both pages reference — the pages differ only in their baked
  `<head>` and their initial language. 100% static output, no server/SSR, no
  router; deploys to Netlify exactly as before. `base: './'` is untouched and
  still required.
- **Relative asset paths under `base: './'` work for the nested page.** Verified
  in built output: `dist/index.html` references `./assets/…`; `dist/vi/index.html`
  references `../assets/…` (Vite computes per-page relative paths). Public-dir
  assets (favicons) are **not** rewritten by Vite, so their relative paths are
  set by hand per file: `./favicon.*` at root, `../favicon.*` in `vi/`.
- **Per-language `<head>` baked at build time** (crawler-visible, not
  JS-injected): `<html lang>`, translated `<title>` and `<meta description>`,
  a self-referential `<link rel="canonical">`, and the three reciprocal
  `hreflang` alternates (`en`, `vi`, `x-default` → English) on **both** pages.
  Absolute production URLs under `https://pdfchill.online` — the domain was not
  previously referenced anywhere in the repo; introduced here and in the sitemap.
- **Initial language from the URL path.** A custom `path` detector is placed
  first in `i18n`'s detection order (`['path', 'localStorage', 'navigator']`):
  it returns `'vi'` only on the `/vi/` path and `undefined` everywhere else, so
  the root page falls through to the **unchanged** `localStorage` → `navigator`
  chain. The path sets the starting point without ever replacing or fighting the
  existing detector. (This entry originally kept `caches: ['localStorage']` to
  persist the choice; that turned out to be the bug fixed in D26 — the
  switcher now persists explicitly and automatic caching is off.)
- **Switcher navigates between `/` and `/vi/`** (a real URL change / full
  reload) instead of toggling in-memory state, so the crawlable page and the UI
  language always agree. Target URL is derived from the current path
  (`homepageUrlForLanguage`), so it works on localhost, `npm run preview`, and a
  subfolder deploy alike — not a hardcoded `/vi/`.
- **`public/sitemap.xml`** lists both URLs with `xhtml:link` hreflang
  alternates; **`public/robots.txt`** points at it. Both copy to `dist/` root.

The Vietnamese `<title>`/`<meta description>` are a first-draft translation
pending native-speaker review, consistent with the rest of the VI copy (see
features.md "Known gaps").

**D26. An explicit language choice is persisted by the switcher, and only by
the switcher; detected tags are normalised before comparison (2026-07-22).**
D25 left a Vietnamese-browser user with no way to reach English at all. Two
independent causes, both fixed in `shared/i18n/index.ts` +
`shared/components/LanguageSwitcher.tsx`:

- **The switcher changed the URL but never recorded the choice.** It relied on
  i18next's `caches: ['localStorage']`, which writes back whatever was
  *detected*, not what was *chosen*. So merely loading `/vi/` (path detector) or
  merely having a Vietnamese browser (navigator) stamped `'vi'` into
  `pdfdemo:lang` as if the user had asked for it — and that stale value then
  outranked `navigator` on the root path forever after. Picking English
  navigated to `/`, where the path detector correctly stays silent, and
  detection fell straight through to the cached/browser `'vi'`.
  Fix: `caches: []`, plus an exported `persistLanguagePreference()` the switcher
  calls immediately before `window.location.assign`. **The stored key now means
  "explicitly chosen" and nothing else**, which is what made it safe to let it
  outrank the browser locale in the first place. Detection order is unchanged
  (`path` → `localStorage` → `navigator`), so `/vi/` opened cold is still
  Vietnamese and `/` opened cold still follows the browser then English.
- **`i18n.language` can be a region tag.** `load: 'languageOnly'` resolves which
  *resources* load, not the reported language string: when the navigator
  detector won, `i18n.language` was `'vi-VN'`, which is not in
  `SUPPORTED_LANGUAGES`. The switcher's `current` therefore fell back to `'en'`
  while the page rendered Vietnamese — the badge read "EN", and clicking English
  was a no-op because `code !== current` was false. This is why the bug report
  said English was unreachable from `/` specifically. Fix: an exported
  `toSupportedLanguage()` that narrows any tag to `'en' | 'vi'`, used by the
  switcher and by `syncDocumentLanguage` (which was also setting
  `<html lang="vi-VN">`). Anything comparing i18next's language against
  `SUPPORTED_LANGUAGES` must go through it.

Verified with Playwright against the production build across simulated browser
locales (`vi-VN`, `en-US`, `fr-FR`): switch both directions with storage
cleared, each surviving a manual reload; `/vi/` cold → Vietnamese regardless of
locale and with nothing written to storage; `/` cold → browser language, then
English. The static `<head>` of both built pages was re-checked and is
unchanged.

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

**R5. The teal/blue palette is reversed back to warm coral/terracotta
(2026-07-22).** D24 replaced a warm coral/cream palette with teal/blue,
citing `reference_photos/pdfchill-website-mockup.pdf`. That file has since
been **overwritten** with a new coral/terracotta/cream mockup, so D24's
description of what it shows is stale — the file is still the source of
truth, its contents just changed. What D24 established structurally
(colour lives only in the three tokens) is unchanged and was re-confirmed
by this swap.

Values were sampled from the mockup, not guessed: the PDF was rendered at
2x via pdfjs and read per-pixel at each element, cross-checked against the
fill operators in its own content streams. `(ref)` in
`tailwind.config.js` now means "sampled at that element".

- **`brand`** is one continuous coral → maroon ramp, so the mockup's strong
  button red is a *step of the scale* (500 = `#b20000`) rather than a new
  token: 100 = `#ffb285` (drop-zone fill, privacy pill), 200 = `#ff865b`
  (upload-icon circle), 600 = `#940000` (hover step, "Chill" wordmark),
  700 = `#740000` (pill text). 300/400 are interpolated. **Deliberate
  divergence:** the mockup draws the drop-zone's dashed border in a crimson
  almost identical to its button red; `border-brand-300` renders it
  `#ea4e2c` instead, because 300 sitting on top of 500 would collapse
  `border-brand-300 → hover:border-brand-400` and the
  `border-brand-200 / border-t-brand-500` spinner into invisible steps.
- **`surface`**: `#ffe5d2` page (ref), white cards (ref), `soft` `#f3d9c7`
  interpolated toward the mockup's `#eac5b1` divider.
- **`ink`**: `#271511` headings (ref), `#5b4039` body (ref). `faint` is
  `#8b7268`, *not* the mockup's own `#61453e` — that is indistinguishable
  from its body copy, and collapsing the third step would flatten a
  hierarchy the app uses in 33 places.

**Two hard-coded colours existed outside the three tokens**, so D24's
"re-theming is a one-file edit" was not quite true and is now corrected:
`index.css`'s body radial-gradient wash was literal
`rgba(0, 108, 118, …)` teal, and `tailwind.config.js`'s `card`/`soft`
box-shadows were a cold teal-black. Both now follow the palette (shadow
geometry untouched). **`LogoMark`'s badge was recoloured too**, on the
product owner's explicit go-ahead — `#006c76` → `#ae0200`, sampled from
the mockup's badge — with `public/favicon.svg` edited in lockstep as D24
requires. Geometry and the `#ebddb9` sand wave are untouched, and the mark
stays deliberately self-coloured rather than joining the tokens. Still
outstanding: `public/favicon.ico` is a binary and is **not** regenerated,
so it remains the old teal badge.

**Error red moved to the `rose-*` ramp.** D24 could keep literal `red-*`
for errors/destructive actions because teal was obviously not red. Against
a maroon brand it is not: `btn-primary` `#b20000` and `text-red-600`
`#dc2626` render as the same colour, so "primary" and "destructive" stop
being distinguishable — verified side by side in the built CSS. All 12
usages moved `red-{50,100,200,600,700}` → `rose-*` (`#e11d48` at 600):
still unmistakably an error colour, pink-shifted well clear of the
terracotta family. Keep error colour *off* the brand hue whenever the
brand moves.
