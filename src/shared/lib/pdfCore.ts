// Shared PDF assembly primitives used by more than one page-management feature
// (buildPdf in workspace, splitPdf/extractPdf in split). Powered by pdf-lib;
// runs entirely in the browser — no bytes are ever sent anywhere.
//
// copyPagesToPdf is the single place pages are copied out AND document marks
// (watermark / page numbers) are baked on (decision D11) — build/split/extract
// all funnel through it.
import { PDFDocument, degrees } from 'pdf-lib'
import type { AssetMap, DocAnnotation, PageItem, SourceDoc } from '../state/types'
import { createBakeSession, bakePage } from './annotationBake'

/** Map of sourceId -> loaded pdf-lib document, so we parse each file only once. */
export type SourceMap = Map<string, PDFDocument>

/** Everything the bake step needs. Omit it to copy pages with no marks. */
export interface BakeInput {
  docAnnotations: DocAnnotation[]
  assets: AssetMap
}

export async function loadSources(
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
 * Copy an ordered list of plan pages into a single new PDF — honouring each
 * page's user rotation and baking on any document marks — and return its bytes.
 * Per-page copying (vs batch) is intentional: it preserves the user's order.
 */
export async function copyPagesToPdf(
  loaded: SourceMap,
  items: PageItem[],
  bake?: BakeInput,
): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const session = bake ? await createBakeSession(out, bake.assets) : null
  const total = items.length

  let pageNumber = 0
  for (const page of items) {
    pageNumber++
    const src = loaded.get(page.sourceId)
    if (!src) continue
    const [copied] = await out.copyPages(src, [page.sourceIndex])
    if (page.rotation) {
      const current = copied.getRotation().angle
      copied.setRotation(degrees((current + page.rotation) % 360))
    }
    out.addPage(copied)

    if (session && bake) {
      await bakePage(session, copied, bake.docAnnotations, { pageNumber, totalPages: total })
    }
  }

  return out.save()
}
