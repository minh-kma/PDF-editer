// Crop (decision D10's neighbor in features.md's Edit group; uses pdf-lib's
// native setCropBox — no pdf.js involved).
//
// A one-shot, on-demand content transform with no ongoing app-state
// involvement (like bakeOcrTextLayer.ts/editText.ts/formFields.ts), not part
// of the D11 annotation pipeline — so it lives in its own module here rather
// than shared/lib/. Its own module folder (not editText.ts or formFields.ts)
// because it shares no code with either — page geometry, not text runs or
// AcroForm fields — matching the "one concern per module folder" pattern
// edit-text/ and forms/ already established under the same `edit` group.
//
// D19: logic-first, UI-last. Nothing here is wired into any UI.
import { PDFDocument } from 'pdf-lib'
import type { Rect } from '../../../shared/state/types'

/** normalized rect (top-left origin) -> pdf-lib rect (bottom-left origin). Mirrors annotationBake.ts's toRect, reused as-is (same direction it's already used in). */
function toRect(r: Rect, W: number, H: number) {
  return { x: r.x * W, y: H - (r.y + r.h) * H, w: r.w * W, h: r.h * H }
}

export interface PageCrop {
  pageIndex: number
  /** Normalized 0..1, top-left origin — same convention as everywhere else. */
  rect: Rect
}

export interface PageCropResult {
  pageIndex: number
  status: 'applied' | 'failed'
  /** Present when status is 'failed'. */
  reason?: string
}

/**
 * Set each page's CropBox (the visible/printable region) to the given
 * normalized rect. Pages not mentioned in `crops` are left completely
 * untouched. A bad entry — an out-of-range page index, or a degenerate rect
 * (zero/negative width or height, or one that doesn't overlap the page's
 * MediaBox at all) — is reported as a per-page failure in `results` rather
 * than aborting the rest of the batch, mirroring formFields.ts's
 * `{ bytes, results }` pattern.
 *
 * A rect that partially overlaps the page (extends past one edge) is NOT
 * clamped — it's passed to setCropBox as-is. This is deliberately in scope
 * with what PDF viewers already do: a CropBox is expected to be intersected
 * with the MediaBox at render/print time, so a partially-out-of-bounds
 * CropBox is normal, well-defined PDF content, not something this function
 * needs to correct.
 *
 * Investigated: `setCropBox` only ever sets the page's `/CropBox` entry —
 * it does not touch `/Contents` (the content stream) or `/MediaBox` in any
 * way. The full page content stays exactly as it was; only the
 * visible/printable region changes, exactly like Acrobat's own crop tool
 * (which also leaves content outside the crop box intact and recoverable —
 * cropping is not a redaction or content-removal tool). `getSize()` reads
 * from `getMediaBox()`, not CropBox, so it keeps reporting the page's true,
 * unchanged dimensions after a crop.
 */
export async function cropPages(
  sourceBytes: Uint8Array,
  crops: PageCrop[],
): Promise<{ bytes: Uint8Array; results: PageCropResult[] }> {
  const pdfDoc = await PDFDocument.load(sourceBytes.slice())
  const pages = pdfDoc.getPages()
  const results: PageCropResult[] = []

  for (const crop of crops) {
    try {
      const page = pages[crop.pageIndex]
      if (!page) throw new Error(`No page at index ${crop.pageIndex}.`)

      const { width: W, height: H } = page.getSize()
      const box = toRect(crop.rect, W, H)

      if (box.w <= 0 || box.h <= 0) {
        throw new Error('Crop rect must have positive width and height.')
      }
      const overlapsPage = box.x < W && box.x + box.w > 0 && box.y < H && box.y + box.h > 0
      if (!overlapsPage) {
        throw new Error('Crop rect does not overlap the page.')
      }

      page.setCropBox(box.x, box.y, box.w, box.h)
      results.push({ pageIndex: crop.pageIndex, status: 'applied' })
    } catch (err) {
      results.push({
        pageIndex: crop.pageIndex,
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { bytes: await pdfDoc.save(), results }
}
