// Shared PDF assembly primitives used by more than one page-management
// feature (e.g. buildPdf in workspace and splitPdf in split). Powered by
// pdf-lib; runs entirely in the browser — no bytes are ever sent anywhere.
import { PDFDocument } from 'pdf-lib'
import type { SourceDoc } from '../state/types'

/** Map of sourceId -> loaded pdf-lib document, so we parse each file only once. */
export type SourceMap = Map<string, PDFDocument>

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
