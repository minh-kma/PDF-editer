// Splits (or extracts pages from) the current page plan. Powered by pdf-lib;
// runs entirely in the browser — no bytes are ever sent anywhere. Page copying
// and annotation baking live in shared/lib/pdfCore.copyPagesToPdf.
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { loadSources, copyPagesToPdf, type BakeInput } from '../../../shared/lib/pdfCore'

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
  bake?: BakeInput,
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
      bytes: await copyPagesToPdf(loaded, slice, bake),
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
  bake?: BakeInput,
): Promise<Uint8Array> {
  const items: PageItem[] = []
  for (const pos of positions) {
    const item = pages[pos - 1]
    if (item) items.push(item)
  }
  if (items.length === 0) throw new Error('No pages selected to extract.')

  const neededIds = new Set(items.map((p) => p.sourceId))
  const loaded = await loadSources(sources, neededIds)
  return copyPagesToPdf(loaded, items, bake)
}
