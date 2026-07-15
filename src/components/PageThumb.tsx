import { useEffect, useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PageItem, SourceDoc } from '../state/types'
import { getThumbnail } from '../lib/thumbnails'
import { RotateIcon, TrashIcon, DragIcon } from './icons'

interface PageThumbProps {
  page: PageItem
  source: SourceDoc | undefined
  position: number // 1-based position shown to the user
  onRotate: (pageId: string) => void
  onDelete: (pageId: string) => void
}

export function PageThumb({ page, source, position, onRotate, onDelete }: PageThumbProps) {
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
      {/* Thumbnail image area (also the drag handle). */}
      <div
        {...attributes}
        {...listeners}
        className="relative flex aspect-[3/4] cursor-grab items-center justify-center bg-cream-soft active:cursor-grabbing"
      >
        {thumb ? (
          <img
            src={thumb}
            alt={`Page ${position}`}
            className="max-h-full max-w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-ink-faint">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
            <span className="text-xs">Loading…</span>
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
          {source?.name ?? 'Unknown'}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onRotate(page.id)}
            title="Rotate 90°"
            aria-label={`Rotate page ${position} 90 degrees`}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
          >
            <RotateIcon width={16} height={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(page.id)}
            title="Delete page"
            aria-label={`Delete page ${position}`}
            className="rounded-lg p-1.5 text-ink-soft hover:bg-red-50 hover:text-red-600"
          >
            <TrashIcon width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
