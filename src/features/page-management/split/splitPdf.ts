// Splits (or extracts pages from) the current page plan. Powered by pdf-lib;
// runs entirely in the browser — no bytes are ever sent anywhere.
import { PDFDocument, degrees } from 'pdf-lib'
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { loadSources, type SourceMap } from '../../../shared/lib/pdfCore'

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
 * Copy an ordered list of plan pages into a single new PDF (honouring each
 * page's user rotation) and return its bytes. Shared by splitPdf (once per
 * range) and extractPdf (once for the whole selection).
 */
async function copyPagesToPdf(loaded: SourceMap, items: PageItem[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const page of items) {
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

    parts.push({
      name: `${baseName}_part${index}_p${range.start}-${range.end}.pdf`,
      bytes: await copyPagesToPdf(loaded, slice),
    })
    index++
  }

  return parts
}

/**
 * Extract specific pages into a single new PDF. `positions` are 1-based plan
 * positions (after any reordering), in the exact order the pages should appear
 * in the output. The current working set is never modified.
 */
export async function extractPdf(
  sources: SourceDoc[],
  pages: PageItem[],
  positions: number[],
): Promise<Uint8Array> {
  const items: PageItem[] = []
  for (const pos of positions) {
    const item = pages[pos - 1]
    if (item) items.push(item)
  }
  if (items.length === 0) throw new Error('No pages selected to extract.')

  const neededIds = new Set(items.map((p) => p.sourceId))
  const loaded = await loadSources(sources, neededIds)
  return copyPagesToPdf(loaded, items)
}
