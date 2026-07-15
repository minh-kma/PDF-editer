// All real PDF editing lives here, powered by pdf-lib. Every function runs
// entirely in the browser — no bytes are ever sent anywhere.
import { PDFDocument, degrees } from 'pdf-lib'
import type { PageItem, SourceDoc } from '../state/types'

/** Map of sourceId -> loaded pdf-lib document, so we parse each file only once. */
type SourceMap = Map<string, PDFDocument>

async function loadSources(
  sources: SourceDoc[],
  neededIds: Set<string>,
): Promise<SourceMap> {
  const map: SourceMap = new Map()
  for (const s of sources) {
    if (!neededIds.has(s.id)) continue
    map.set(s.id, await PDFDocument.load(s.bytes.slice()))
  }
  return map
}

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

/**
 * Safe, lossless "compression": re-save the assembled PDF with object streams,
 * which removes wasted structure and often shrinks the file. Honest note for
 * the UI: savings vary a lot by file and can be small for image-heavy PDFs.
 */
export async function compressPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes.slice())
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}
