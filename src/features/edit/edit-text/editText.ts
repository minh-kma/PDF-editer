// Edit Text (decision D6): PDFAid-style — extract text runs via pdf.js,
// allow inline editing, write back with pdf-lib. Accept the documented
// limitations (font substitution, layout shift, scanned PDFs need OCR
// first — out of scope here, assumed already handled upstream).
//
// A one-shot, on-demand content transform with no ongoing app-state
// involvement (like bakeOcrTextLayer.ts), not part of the D11 annotation
// pipeline — so it lives in its own `edit/` group here rather than
// shared/lib/, even though applyTextEdits reuses that pipeline's drawing
// techniques (Eraser's opaque cover, "Add text"'s font-loading approach).
// `edit/` is architecture.md's own documented "likely home" for Edit-group
// tools that don't share code with page-management/optimize/security.
//
// D19: logic-first, UI-last. Nothing here is wired into any UI.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { Rect } from '../../../shared/state/types'
import { getPageCount, getPageTextRuns, forgetDoc } from '../../../shared/lib/pdfjs'

/**
 * Shown to the user before an edit is applied (decision D6's disclosure
 * requirement) — a plain string for a future dialog/banner to render; no UI
 * is built here.
 *
 * i18n: this is the one piece of user-facing copy still hard-coded in English,
 * deliberately. Edit text has no UI yet (D19), so there is nothing rendering
 * it and no `editText` namespace to put it in — creating a one-key namespace
 * for a string with no consumer would be speculative. When the UI is built,
 * move this text into `shared/i18n/locales/<lang>/editText.json` and render it
 * with `t()`, exactly as OCR's disclosure was handled.
 */
export const EDIT_TEXT_DISCLOSURE =
  "Editing text covers the original with your new text — it doesn't erase what was underneath, so the old text may still be found by anyone who inspects the file closely (same as our Eraser tool). The replacement font may not exactly match the original, and longer text can shift the layout."

/** One editable text run, in pdf.js's native per-run granularity (no line/paragraph merging — a future UI concern). */
export interface PageTextItem {
  /** Stable within one extractEditableText() call: "{pageIndex}:{runIndex}". */
  id: string
  text: string
  /** Normalized 0..1, top-left origin, relative to the page's unrotated crop box — same convention as Annotation.rect. */
  rect: Rect
  /** Approximate font size, in PDF points, derived from the run's text matrix. */
  fontSize: number
}

/**
 * Read-only: extract each page's text runs (id, original string, bounding
 * rect, approximate font size) for a future editing UI. Never modifies the
 * PDF (pdf.js draws/reads, pdf-lib edits — this step is pdf.js-only).
 */
export async function extractEditableText(sourceBytes: Uint8Array): Promise<PageTextItem[][]> {
  const sourceId = `edit-text:${crypto.randomUUID()}`
  const pageCount = await getPageCount(sourceBytes)
  const pages: PageTextItem[][] = []

  try {
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const { runs, width: W, height: H } = await getPageTextRuns(sourceId, sourceBytes, pageIndex)
      const items: PageTextItem[] = []

      runs.forEach((run, runIndex) => {
        if (!run.text.trim()) return
        const [a, b, c, d, e, f] = run.transform
        // Magnitude of the text matrix's vertical basis vector — the
        // standard way to recover an approximate font size regardless of
        // any rotation/skew baked into the run's transform.
        const fontSize = Math.hypot(c, d) || Math.hypot(a, b) || 12
        const boxHeight = run.height || fontSize
        items.push({
          id: `${pageIndex}:${runIndex}`,
          text: run.text,
          fontSize,
          rect: {
            x: e / W,
            y: 1 - (f + boxHeight) / H,
            w: run.width / W,
            h: boxHeight / H,
          },
        })
      })

      pages.push(items)
    }
  } finally {
    forgetDoc(sourceId)
  }

  return pages
}

/** One text replacement: a page + the target rect from extractEditableText's output + the new string. */
export interface TextEdit {
  pageIndex: number
  rect: Rect
  text: string
  /** In PDF points; defaults to the rect's height if omitted. */
  fontSize?: number
  /** Hex colour, e.g. "#1a1a1a"; defaults to black if omitted. */
  color?: string
}

/** normalized rect (top-left origin) -> pdf-lib rect (bottom-left origin). Mirrors annotationBake.ts's toRect. */
function toRect(r: Rect, W: number, H: number) {
  return { x: r.x * W, y: H - (r.y + r.h) * H, w: r.w * W, h: r.h * H }
}

/** Mirrors annotationBake.ts's hex() color parsing. */
function hex(color: string | undefined) {
  const c = (color ?? '#000000').replace('#', '')
  const n = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c
  const int = parseInt(n, 16)
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255)
}

/**
 * Apply text edits to a PDF's bytes. Per the confirmed product decision,
 * each edit works exactly like the Eraser tool (D5): an opaque white
 * rectangle is drawn over the target region, then the new text is drawn on
 * top. This does NOT remove the original text-showing operators — the old
 * text remains present/extractable underneath, same as Eraser. Font loading
 * mirrors annotationBake.ts's "Add text" handling (one embedded Helvetica
 * per document). Pages/regions with no edit are untouched.
 */
export async function applyTextEdits(sourceBytes: Uint8Array, edits: TextEdit[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice())
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const edit of edits) {
    const page = pdfDoc.getPage(edit.pageIndex)
    const { width: W, height: H } = page.getSize()
    const box = toRect(edit.rect, W, H)
    const size = edit.fontSize ?? Math.max(box.h, 1)

    // Eraser technique (D5): opaque cover, no content-stream surgery.
    page.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, color: rgb(1, 1, 1) })
    page.drawText(edit.text, { x: box.x, y: box.y, size, font, color: hex(edit.color) })
  }

  return pdfDoc.save()
}
