// Renders and caches page thumbnails so scrolling/reordering doesn't re-draw
// pages needlessly. Cache key includes rotation so turning a page refreshes it.
import { renderPage } from './pdfjs'
import type { SourceDoc } from '../state/types'

const THUMB_WIDTH = 200 // CSS px; small enough to stay fast, sharp enough to read

const cache = new Map<string, string>()

function key(sourceId: string, sourceIndex: number, rotation: number) {
  return `${sourceId}:${sourceIndex}:${rotation}`
}

export async function getThumbnail(
  source: SourceDoc,
  sourceIndex: number,
  rotation: number,
): Promise<string> {
  const k = key(source.id, sourceIndex, rotation)
  const cached = cache.get(k)
  if (cached) return cached
  const url = await renderPage(source.id, source.bytes, sourceIndex, rotation, THUMB_WIDTH)
  cache.set(k, url)
  return url
}
