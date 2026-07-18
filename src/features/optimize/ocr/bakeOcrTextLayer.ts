// Write-back half of OCR (decision D7): takes already-computed OCR results
// and draws an invisible, searchable text layer onto the matching source
// PDF. Deliberately standalone — this does NOT call ocrDocument()/run
// Tesseract itself (that's a separately-testable unit); it only consumes
// PageOcrResult[] that some caller already produced.
//
// A one-shot, on-demand operation the user explicitly triggers (like
// compressPdf.ts/protectPdf.ts), not part of the universal per-edit-session
// export pipeline (shared/lib/annotationBake.ts + pdfCore.copyPagesToPdf,
// decision D11) — so it lives alongside ocrDocument.ts here rather than in
// shared/lib/. Once baked, the invisible words are ordinary page content;
// any later copyPagesToPdf call (merge/split/rotate/etc.) carries them along
// automatically, same as any other real text on the page.
import {
  PDFDocument,
  StandardFonts,
  TextRenderingMode,
  pushGraphicsState,
  popGraphicsState,
  setTextRenderingMode,
} from 'pdf-lib'
import type { Rect } from '../../../shared/state/types'
import type { PageOcrResult } from './ocrDocument'

/**
 * Normalized rect (top-left origin) -> pdf-lib rect (bottom-left origin).
 * Mirrors shared/lib/annotationBake.ts's toRect exactly (same convention,
 * kept local here since this module isn't part of that pipeline). As in
 * that file, W/H come straight from page.getSize() with no rotation
 * adjustment — correct for the common case of pages with no intrinsic
 * /Rotate, which is how annotationBake.ts's own normalized rects work too.
 */
function toRect(r: Rect, W: number, H: number) {
  return { x: r.x * W, y: H - (r.y + r.h) * H, w: r.w * W, h: r.h * H }
}

/**
 * Draw an invisible text layer onto every page OCR actually recognized, so
 * the page becomes searchable/selectable/copyable without changing how it
 * looks. Pages marked `skipped` in ocrResults (they already had a real text
 * layer) are left completely untouched — no pass over them at all.
 *
 * Invisibility uses PDF text rendering mode 3 ("neither fill nor stroke" —
 * the `Tr` operator, exposed by pdf-lib as `TextRenderingMode.Invisible`).
 * `drawText`'s own options have no render-mode switch, so the mode is set
 * via pdf-lib's lower-level operator API and scoped with a push/pop of the
 * graphics state around each word, so nothing else on the page is affected.
 */
export async function bakeOcrTextLayer(
  sourceBytes: Uint8Array,
  ocrResults: PageOcrResult[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice())
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  for (const result of ocrResults) {
    if (result.status === 'skipped') continue

    const page = pdfDoc.getPage(result.pageIndex)
    const { width: W, height: H } = page.getSize()

    for (const word of result.words) {
      if (!word.text.trim()) continue
      const box = toRect(word.rect, W, H)
      const size = Math.max(box.h, 1) // drawText rejects a zero/negative size

      page.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible))
      page.drawText(word.text, { x: box.x, y: box.y, size, font })
      page.pushOperators(popGraphicsState())
    }
  }

  return pdfDoc.save()
}
