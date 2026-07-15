// Assembles the ordered page plan into a single PDF — this is where merge,
// delete, reorder and rotate all come together. Powered by pdf-lib; runs
// entirely in the browser — no bytes are ever sent anywhere.
import { PDFDocument, degrees } from 'pdf-lib'
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { loadSources } from '../../../shared/lib/pdfCore'

/**
 * Build a single PDF from an ordered list of pages (this is where merge,
 * delete, reorder and rotate all come together). Returns the new PDF bytes.
 */
export async function buildPdf(
  sources: SourceDoc[],
  pages: PageItem[],
): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('There are no pages to save.')

  const out = await PDFDocument.create()
  const neededIds = new Set(pages.map((p) => p.sourceId))
  const loaded = await loadSources(sources, neededIds)

  // pdf-lib copies pages most efficiently in batches per source document, but
  // to honour the user's exact order we copy one page at a time.
  for (const page of pages) {
    const src = loaded.get(page.sourceId)
    if (!src) continue
    const [copied] = await out.copyPages(src, [page.sourceIndex])
    if (page.rotation) {
      const current = copied.getRotation().angle
      copied.setRotation(degrees((current + page.rotation) % 360))
    }
    out.addPage(copied)
  }

  return out.save()
}
