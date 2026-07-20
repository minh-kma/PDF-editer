// First-page preview backing both doc-level panels' live previews: a rendered
// image of page 1 (at its current rotation) plus the pt size of that displayed
// page, so pt-based values (font size, margins) can scale to preview px.
import { useEffect, useState } from 'react'
import { useStore } from '../../../shared/state/store'
import { renderPage, getPageSizePt } from '../../../shared/lib/pdfjs'

const PREVIEW_RENDER_WIDTH = 640

export interface FirstPagePreview {
  url: string | null
  /** Size in PDF points of the page AS DISPLAYED (w/h swapped for 90°/270°). */
  displayedPt: { width: number; height: number } | null
  /** The first page's PageItem.rotation, for rotation-aware overlays. */
  pageRotation: number
}

export function useFirstPagePreview(): FirstPagePreview {
  const { pages, getSource } = useStore()
  const page = pages[0]
  const source = page ? getSource(page.sourceId) : undefined
  const [url, setUrl] = useState<string | null>(null)
  const [sizePt, setSizePt] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!source || !page) return
    renderPage(source.id, source.bytes, page.sourceIndex, page.rotation, PREVIEW_RENDER_WIDTH)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null))
    getPageSizePt(source.id, source.bytes, page.sourceIndex)
      .then((s) => !cancelled && setSizePt(s))
      .catch(() => !cancelled && setSizePt(null))
    return () => {
      cancelled = true
    }
  }, [source, page?.sourceIndex, page?.rotation])

  const pageRotation = page?.rotation ?? 0
  const displayedPt =
    sizePt && pageRotation % 180 !== 0
      ? { width: sizePt.height, height: sizePt.width }
      : sizePt

  return { url, displayedPt, pageRotation }
}
