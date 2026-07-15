// Splits the current page plan into several PDFs, one per range. Powered by
// pdf-lib; runs entirely in the browser — no bytes are ever sent anywhere.
import { PDFDocument, degrees } from 'pdf-lib'
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { loadSources } from '../../../shared/lib/pdfCore'

export interface SplitRange {
  /** 1-based inclusive start page (position in the current plan). */
  start: number
  /** 1-based inclusive end page. */
  end: number
}

/** Result of splitting: one named PDF per range. */
export interface SplitPart {
  name: string
  bytes: Uint8Array
}

/**
 * Split the current page plan into several PDFs, one per range.
 * Ranges refer to positions in the plan (after any reordering), 1-based.
 */
export async function splitPdf(
  sources: SourceDoc[],
  pages: PageItem[],
  ranges: SplitRange[],
  baseName: string,
): Promise<SplitPart[]> {
  const parts: SplitPart[] = []
  const neededIds = new Set(pages.map((p) => p.sourceId))
  const loaded = await loadSources(sources, neededIds)

  let index = 1
  for (const range of ranges) {
    const slice = pages.slice(range.start - 1, range.end)
    if (slice.length === 0) continue

    const out = await PDFDocument.create()
    for (const page of slice) {
      const src = loaded.get(page.sourceId)
      if (!src) continue
      const [copied] = await out.copyPages(src, [page.sourceIndex])
      if (page.rotation) {
        const current = copied.getRotation().angle
        copied.setRotation(degrees((current + page.rotation) % 360))
      }
      out.addPage(copied)
    }
    parts.push({
      name: `${baseName}_part${index}_p${range.start}-${range.end}.pdf`,
      bytes: await out.save(),
    })
    index++
  }

  return parts
}
