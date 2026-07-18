import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../../shared/state/store'
import { usePageRender, useZoom, ZoomControls } from './PageStage'
import { getThumbnail } from '../../../shared/lib/thumbnails'
import type { PageItem, SourceDoc } from '../../../shared/state/types'

// How far a page can be from the viewport and still be rendered ahead of
// time — big enough that scrolling feels seamless, small enough that a huge
// document doesn't render every page up front.
const RENDER_ROOT_MARGIN = '1200px 0px'

/**
 * Default post-upload view: a thumbnail sidebar (every page, current page
 * highlighted, click to jump) next to a continuous vertical scroll of every
 * page — the traditional PDF-reader layout. Rendering logic lives in
 * PageStage.tsx (`usePageRender`, one call per visible page), shared with
 * PageZoom.tsx (the "Manage pages" grid's double-click modal, which keeps
 * its own single-page `usePageStage` and is unaffected by this).
 */
export function BrowseView() {
  const { pages, getSource } = useStore()
  const [activeId, setActiveId] = useState<string | null>(pages[0]?.id ?? null)
  const [rendered, setRendered] = useState<Set<string>>(() => new Set())
  const { zoom, zoomIn, zoomOut } = useZoom()

  const pageEls = useRef(new Map<string, HTMLDivElement>())
  const sidebarThumbEls = useRef(new Map<string, HTMLButtonElement>())

  // Two observers over the same page containers: one decides which page is
  // "current" (for the sidebar highlight), the other lazily marks pages as
  // renderable once they're near the viewport. A page that's been rendered
  // once stays rendered — typical PDFs here aren't large enough to need
  // unmount-on-scroll-away virtualization.
  useEffect(() => {
    const els = Array.from(pageEls.current.values())
    if (els.length === 0) return

    const activeObserver = new IntersectionObserver(
      (entries) => {
        let best: IntersectionObserverEntry | null = null
        for (const entry of entries) {
          if (entry.isIntersecting && (!best || entry.intersectionRatio > best.intersectionRatio)) {
            best = entry
          }
        }
        const id = best?.target.getAttribute('data-page-id')
        if (id) setActiveId(id)
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    )

    const renderObserver = new IntersectionObserver(
      (entries) => {
        const newlyVisible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target.getAttribute('data-page-id'))
          .filter((id): id is string => !!id)
        if (newlyVisible.length === 0) return
        setRendered((prev) => {
          const next = new Set(prev)
          for (const id of newlyVisible) next.add(id)
          return next
        })
      },
      { rootMargin: RENDER_ROOT_MARGIN, threshold: 0.01 },
    )

    for (const el of els) {
      activeObserver.observe(el)
      renderObserver.observe(el)
    }
    return () => {
      activeObserver.disconnect()
      renderObserver.disconnect()
    }
  }, [pages])

  // Keep the sidebar following the main content: whenever the active page
  // changes (driven by scrolling the main area), bring its thumbnail into
  // view. `block: 'nearest'` is a no-op if it's already visible, so this
  // doesn't fight a user who's manually scrolled the sidebar to look ahead —
  // it only moves the sidebar when the highlighted thumbnail has actually
  // scrolled out of view.
  useEffect(() => {
    if (!activeId) return
    sidebarThumbEls.current.get(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  const scrollToPage = (id: string) => {
    pageEls.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (pages.length === 0) return null

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <aside className="sticky top-24 max-h-[calc(100vh-7rem)] w-16 flex-none space-y-2 overflow-y-auto pb-2 pr-1 sm:w-24">
        {pages.map((page, i) => (
          <SidebarThumb
            key={page.id}
            page={page}
            source={getSource(page.sourceId)}
            position={i + 1}
            active={page.id === activeId}
            onClick={() => scrollToPage(page.id)}
            registerEl={(el) => {
              if (el) sidebarThumbEls.current.set(page.id, el)
              else sidebarThumbEls.current.delete(page.id)
            }}
          />
        ))}
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        {pages.map((page, i) => (
          <PageRow
            key={page.id}
            page={page}
            source={getSource(page.sourceId)}
            position={i + 1}
            zoom={zoom}
            shouldRender={rendered.has(page.id)}
            registerEl={(el) => {
              if (el) pageEls.current.set(page.id, el)
              else pageEls.current.delete(page.id)
            }}
          />
        ))}
      </div>

      <ZoomControls
        zoom={zoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2"
      />
    </div>
  )
}

interface SidebarThumbProps {
  page: PageItem
  source: SourceDoc | undefined
  position: number
  active: boolean
  onClick: () => void
  registerEl: (el: HTMLButtonElement | null) => void
}

function SidebarThumb({ page, source, position, active, onClick, registerEl }: SidebarThumbProps) {
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!source) return
    getThumbnail(source, page.sourceIndex, page.rotation)
      .then((url) => !cancelled && setThumb(url))
      .catch(() => !cancelled && setThumb(null))
    return () => {
      cancelled = true
    }
  }, [source, page.sourceIndex, page.rotation])

  return (
    <button
      ref={registerEl}
      type="button"
      onClick={onClick}
      aria-current={active}
      aria-label={`Jump to page ${position}`}
      className={`icon-btn flex w-full flex-col items-center gap-1 rounded-lg border-2 p-1 ${
        active
          ? 'border-brand-500 bg-brand-50'
          : 'border-transparent hover:border-brand-100 hover:bg-cream-soft'
      }`}
    >
      <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md bg-cream-soft">
        {thumb ? (
          <img
            src={thumb}
            alt={`Page ${position}`}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
        )}
      </div>
      <span className={`text-[11px] font-semibold ${active ? 'text-brand-600' : 'text-ink-faint'}`}>
        {position}
      </span>
    </button>
  )
}

interface PageRowProps {
  page: PageItem
  source: SourceDoc | undefined
  position: number
  zoom: number
  shouldRender: boolean
  registerEl: (el: HTMLDivElement | null) => void
}

function PageRow({ page, source, position, zoom, shouldRender, registerEl }: PageRowProps) {
  // Withholding `page` until the container has scrolled near the viewport is
  // what makes rendering lazy — usePageRender itself just skips work when
  // either argument is undefined.
  const url = usePageRender(source, shouldRender ? page : undefined, zoom)

  return (
    <div
      ref={registerEl}
      data-page-id={page.id}
      className="card scroll-mt-24 flex flex-col items-center gap-2 p-3 sm:p-4"
    >
      <p className="text-xs font-semibold text-ink-faint">Page {position}</p>
      <div className="flex min-h-[60vh] w-full items-center justify-center overflow-x-auto rounded-xl bg-cream-soft">
        {url ? (
          // Width is driven by `zoom` directly (same technique as PageZoom.tsx's
          // wrapper) so the page visibly grows/shrinks — usePageRender's
          // resolution bump is about sharpness, not display size, so without
          // this the page never actually looked different when zoomed.
          <img
            src={url}
            alt={`Page ${position}`}
            style={{ width: `${zoom * 100}%` }}
            className="max-w-none flex-none object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-ink-faint">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
            {shouldRender && <span className="text-sm">Rendering…</span>}
          </div>
        )}
      </div>
    </div>
  )
}
