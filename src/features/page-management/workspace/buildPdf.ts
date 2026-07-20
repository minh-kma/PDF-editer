// Assembles the ordered page plan into a single PDF — this is where merge,
// delete, reorder, rotate and document-mark baking all come together. Powered
// by pdf-lib; runs entirely in the browser — no bytes are ever sent anywhere.
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { loadSources, copyPagesToPdf, type BakeInput } from '../../../shared/lib/pdfCore'

/**
 * Build a single PDF from an ordered list of pages. Pass `bake` to draw the
 * user's watermark / page numbers onto the output; omit it for a plain assembly.
 */
export async function buildPdf(
  sources: SourceDoc[],
  pages: PageItem[],
  bake?: BakeInput,
): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('There are no pages to save.')

  const neededIds = new Set(pages.map((p) => p.sourceId))
  const loaded = await loadSources(sources, neededIds)
  return copyPagesToPdf(loaded, pages, bake)
}
