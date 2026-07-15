import { useEffect, useState } from 'react'
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { renderPage } from '../../../shared/lib/pdfjs'
import { PlusIcon, MinusIcon } from '../../../shared/components/icons'

// Base render width at 1x zoom — well above the 200px grid thumbnail so text is
// sharp. Zooming in re-renders at a higher width (not a CSS upscale of the same
// bitmap), so detail stays crisp. Capped to bound memory on a single image.
const BASE_WIDTH = 1600
const MAX_RENDER_WIDTH = 3600
const ZOOM_MIN = 1
const ZOOM_MAX = 3
const ZOOM_STEP = 0.5

interface PageZoomProps {
  page: PageItem
  source: SourceDoc | undefined
  position: number // 1-based page number, for the alt text
  onClose: () => void
}

export function PageZoom({ page, source, position, onClose }: PageZoomProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  // The image is re-rendered at this resolution, so higher zoom => sharper.
  const renderWidth = Math.min(MAX_RENDER_WIDTH, Math.round(BASE_WIDTH * zoom))

  // Close on Esc, and stop the page behind from scrolling while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // Render a high-resolution image of just this page. Re-runs when the zoom
  // level (renderWidth) changes; the previous image stays visible until the
  // sharper one is ready, so zooming doesn't flicker.
  useEffect(() => {
    let cancelled = false
    if (!source) return
    renderPage(source.id, source.bytes, page.sourceIndex, page.rotation, renderWidth)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null))
    return () => {
      cancelled = true
    }
  }, [source, page.sourceIndex, page.rotation, renderWidth])

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Enlarged view of page ${position}`}
    >
      {/* Grows with the zoomed image and scrolls when it exceeds the viewport,
          while still centring the image when it fits. */}
      <div className="flex min-h-full min-w-full items-center justify-center p-4 sm:p-8">
        {url ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: `${zoom * 88}vmin`, height: `${zoom * 88}vmin` }}
            className="flex flex-none items-center justify-center"
          >
            <img
              src={url}
              alt={`Page ${position}, enlarged`}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            <span className="text-sm">Rendering…</span>
          </div>
        )}
      </div>

      {/* Zoom controls — fixed so they stay put while the image scrolls. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/70 px-2 py-1.5 text-white shadow-lg"
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Zoom out"
          className="btn-motion rounded-full p-2 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MinusIcon width={18} height={18} />
        </button>
        <span className="w-12 text-center text-sm font-semibold tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Zoom in"
          className="btn-motion rounded-full p-2 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PlusIcon width={18} height={18} />
        </button>
      </div>
    </div>
  )
}
