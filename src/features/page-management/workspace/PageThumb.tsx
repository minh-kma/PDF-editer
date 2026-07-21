import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PageItem, SourceDoc } from '../../../shared/state/types'
import { getThumbnail } from '../../../shared/lib/thumbnails'
import { RotateIcon, TrashIcon, DragIcon } from '../../../shared/components/icons'

interface PageThumbProps {
  page: PageItem
  source: SourceDoc | undefined
  position: number // 1-based position shown to the user
  onRotate: (pageId: string) => void
  onDelete: (pageId: string) => void
  onEnlarge: (page: PageItem) => void
}

export function PageThumb({ page, source, position, onRotate, onDelete, onEnlarge }: PageThumbProps) {
  const { t } = useTranslation('workspace')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id })

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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-soft transition-shadow ${
        isDragging ? 'z-10 opacity-80 shadow-card ring-2 ring-brand-300' : ''
      }`}
    >
      {/* Thumbnail image area (also the drag handle). Double-click enlarges. */}
      <div
        {...attributes}
        {...listeners}
        onDoubleClick={() => onEnlarge(page)}
        title={t('doubleClickToEnlarge')}
        className="relative flex aspect-[3/4] cursor-grab items-center justify-center bg-surface-soft active:cursor-grabbing"
      >
        {thumb ? (
          <img
            src={thumb}
            alt={t('pageAlt', { position })}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-ink-faint">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
            <span className="text-xs">{t('loading')}</span>
          </div>
        )}

        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {position}
        </span>
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-white/85 p-1 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
          <DragIcon width={14} height={14} />
        </span>
      </div>

      {/* Per-page controls. */}
      <div className="flex items-center justify-between gap-1 border-t border-black/5 px-2 py-1.5">
        <span className="truncate text-[11px] text-ink-faint" title={source?.name}>
          {/* The file name is the user's own content — shown verbatim. */}
          {source?.name ?? t('unknownFile')}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onRotate(page.id)}
            title={t('rotate90')}
            aria-label={t('rotatePageAria', { position })}
            className="icon-btn rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
          >
            <RotateIcon width={16} height={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(page.id)}
            title={t('deletePage')}
            aria-label={t('deletePageAria', { position })}
            className="icon-btn rounded-lg p-1.5 text-ink-soft hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
