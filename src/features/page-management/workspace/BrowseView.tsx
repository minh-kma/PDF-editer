import { useEffect, useState } from 'react'
import { useStore } from '../../../shared/state/store'
import { usePageStage, ZoomControls } from './PageStage'
import { ChevronLeftIcon, ChevronRightIcon } from '../../../shared/components/icons'

/**
 * Default post-upload view: one page at a time, large, with prev/next
 * navigation — the neutral "just look at my file" state. Rendering/zoom
 * logic lives in PageStage.tsx, shared with PageZoom.tsx (the "Manage
 * pages" grid's double-click modal).
 */
export function BrowseView() {
  const { pages, getSource } = useStore()
  const [index, setIndex] = useState(0)

  // Stay in range if pages were deleted/reordered elsewhere.
  const clampedIndex = Math.min(index, Math.max(0, pages.length - 1))
  const page = pages[clampedIndex]
  const source = page ? getSource(page.sourceId) : undefined

  const { url, zoom, zoomIn, zoomOut } = usePageStage(source, page)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      else if (e.key === 'ArrowRight') setIndex((i) => Math.min(pages.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pages.length])

  if (!page) return null

  return (
    <div className="card flex flex-col items-center gap-4 p-4 sm:p-6">
      <p className="text-sm font-semibold text-ink-soft">
        Page {clampedIndex + 1} of {pages.length}
      </p>

      <div className="flex w-full items-center justify-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={clampedIndex === 0}
          aria-label="Previous page"
          className="btn-motion flex-none rounded-full p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeftIcon width={22} height={22} />
        </button>

        <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-hidden rounded-xl bg-cream-soft">
          {url ? (
            <img
              src={url}
              alt={`Page ${clampedIndex + 1}`}
              className="max-h-[70vh] max-w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-ink-faint">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
              <span className="text-sm">Rendering…</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
          disabled={clampedIndex === pages.length - 1}
          aria-label="Next page"
          className="btn-motion flex-none rounded-full p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRightIcon width={22} height={22} />
        </button>
      </div>

      <ZoomControls zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut} />
    </div>
  )
}
