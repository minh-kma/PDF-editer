import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { renderPage } from '../../../shared/lib/pdfjs'
import { PlusIcon, MinusIcon } from '../../../shared/components/icons'

// Base render width at 1x zoom — well above the 200px grid thumbnail so text is
// sharp. Zooming in re-renders at a higher width (not a CSS upscale of the same
// bitmap), so detail stays crisp. Capped to bound memory on a single image.
const BASE_WIDTH = 1600
const MAX_RENDER_WIDTH = 3600
const ZOOM_MIN = 0.2
const ZOOM_MAX = 3
const ZOOM_STEP = 0.1

/** Zoom is stored as a fraction; keep it clean to whole percents. */
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))

/**
 * Low-level render core: given a page and a caller-controlled zoom, renders
 * it at a resolution that scales with that zoom (so zooming in re-renders
 * sharper, not a CSS upscale of the same bitmap). Zoom itself is NOT owned
 * here — callers that need their own zoom state wrap this (see
 * `usePageStage` below); callers that share one zoom across many pages
 * (BrowseView's continuous scroll) call this directly per page instead.
 */
export function usePageRender(
  source: SourceDoc | undefined,
  page: PageItem | undefined,
  zoom: number,
) {
  const [url, setUrl] = useState<string | null>(null)

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

  return url
}

/**
 * Render core plus caller-owned zoom state, resetting to 1x whenever the
 * page itself changes. Used by PageZoom.tsx (the grid's double-click modal)
 * — a single page shown at a time, so its own zoom level makes sense.
 */
export function usePageStage(source: SourceDoc | undefined, page: PageItem | undefined) {
  const [zoom, setZoom] = useState(1)
  const url = usePageRender(source, page, zoom)

  useEffect(() => {
    setZoom(1)
  }, [page?.id])

  return {
    url,
    zoom,
    zoomIn: () => setZoom((z) => clampZoom(z + ZOOM_STEP)),
    zoomOut: () => setZoom((z) => clampZoom(z - ZOOM_STEP)),
    setZoom: (z: number) => setZoom(clampZoom(z)),
  }
}

/**
 * Standalone zoom state with the same bounds/step as `usePageStage`, for a
 * caller that applies one zoom level across many pages at once (BrowseView's
 * continuous scroll) instead of owning it per-page.
 */
export function useZoom(initial = 1) {
  const [zoom, setZoom] = useState(initial)
  return {
    zoom,
    zoomIn: () => setZoom((z) => clampZoom(z + ZOOM_STEP)),
    zoomOut: () => setZoom((z) => clampZoom(z - ZOOM_STEP)),
    setZoom: (z: number) => setZoom(clampZoom(z)),
  }
}

interface ZoomControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  /** Commit a typed percentage (already clamped by the hook's setZoom). */
  onZoomChange: (zoom: number) => void
  className?: string
}

/** The floating -/percentage/+ pill, shared between PageZoom and BrowseView. */
export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomChange,
  className,
}: ZoomControlsProps) {
  // The percentage is a free-form text box while focused (so it can be cleared
  // and retyped) and snaps back to the real zoom on commit — an unparsable or
  // out-of-range entry just clamps.
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    const n = parseFloat((draft ?? '').replace('%', '').trim())
    if (Number.isFinite(n)) onZoomChange(n / 100)
    setDraft(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    }
  }

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
        className="icon-btn rounded-full p-2 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <MinusIcon width={18} height={18} />
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Zoom level, in percent"
        title="Type a zoom percentage"
        value={draft ?? `${Math.round(zoom * 100)}%`}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => {
          setDraft(String(Math.round(zoom * 100)))
          e.target.select()
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="w-14 cursor-text rounded-md bg-transparent px-1 py-0.5 text-center text-sm font-semibold tabular-nums outline-none hover:bg-white/15 focus:bg-white/20"
      />
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX}
        aria-label="Zoom in"
        className="icon-btn rounded-full p-2 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PlusIcon width={18} height={18} />
      </button>
    </div>
  )
}
