import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { usePageStage, ZoomControls } from './PageStage'

interface PageZoomProps {
  page: PageItem
  source: SourceDoc | undefined
  position: number // 1-based page number, for the alt text
  onClose: () => void
}

/**
 * Modal single-page enlarge, opened by double-clicking a thumbnail in the
 * "Manage pages" grid. Rendering/zoom logic lives in PageStage.tsx, shared
 * with BrowseView.tsx (the default paginated viewer) — this component keeps
 * only the modal chrome (backdrop, Esc-to-close, scroll-lock).
 */
export function PageZoom({ page, source, position, onClose }: PageZoomProps) {
  const { t } = useTranslation('workspace')
  const { url, zoom, zoomIn, zoomOut, setZoom } = usePageStage(source, page)

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

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-black/70"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t('enlargedViewAria', { position })}
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
              alt={t('pageEnlargedAlt', { position })}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            <span className="text-sm">{t('rendering')}</span>
          </div>
        )}
      </div>

      <ZoomControls
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomChange={setZoom}
        className="fixed bottom-5 left-1/2 -translate-x-1/2"
      />
    </div>
  )
}
