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

/**
 * Shared render-and-zoom core for showing one page at high resolution.
 * Used by PageZoom.tsx (the grid's double-click modal) and BrowseView.tsx
 * (the default paginated single-page view) — extracted so both get the
 * same crisp re-render-on-zoom behavior without duplicating it.
 */
export function usePageStage(source: SourceDoc | undefined, page: PageItem | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)

  // The image is re-rendered at this resolution, so higher zoom => sharper.
  const renderWidth = Math.min(MAX_RENDER_WIDTH, Math.round(BASE_WIDTH * zoom))

  useEffect(() => {
    let cancelled = false
    if (!source || !page) return
    renderPage(source.id, source.bytes, page.sourceIndex, page.rotation, renderWidth)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => !cancelled && setUrl(null))
    return () => {
      cancelled = true
    }
  }, [source, page?.sourceIndex, page?.rotation, renderWidth])

  // Reset zoom when the page itself changes, so navigating to a different
  // page (BrowseView's prev/next) doesn't carry a zoomed-in level along.
  useEffect(() => {
    setZoom(1)
  }, [page?.id])

  return {
    url,
    zoom,
    zoomIn: () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP)),
    zoomOut: () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP)),
  }
}

interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  className?: string
}

/** The floating -/percentage/+ pill, shared between PageZoom and BrowseView. */
export function ZoomControls({ zoom, onZoomIn, onZoomOut, className }: ZoomControlsProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex items-center gap-1 rounded-full bg-black/70 px-2 py-1.5 text-white shadow-lg ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={onZoomOut}
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
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX}
        aria-label="Zoom in"
        className="btn-motion rounded-full p-2 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PlusIcon width={18} height={18} />
      </button>
    </div>
  )
}
