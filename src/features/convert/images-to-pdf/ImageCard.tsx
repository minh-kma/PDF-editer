// One staged image: its own toolbar (rotate left/right, enlarge, remove) above
// a draggable thumbnail, matching the reference layout. Mirrors the dnd-kit
// pattern from page-management's PageThumb without importing it — that one is
// PDF-page specific (pdf.js thumbnails, PageItem/SourceDoc) and lives in a
// sibling module, which modules must not import from (architecture.md).
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ImageItem } from './useImageList'
import {
  RotateIcon,
  RotateLeftIcon,
  ExpandIcon,
  TrashIcon,
  DragIcon,
} from '../../../shared/components/icons'

interface ImageCardProps {
  image: ImageItem
  position: number // 1-based, shown to the user
  onRotate: (id: string, delta: number) => void
  onEnlarge: (image: ImageItem) => void
  onRemove: (id: string) => void
}

export function ImageCard({ image, position, onRotate, onEnlarge, onRemove }: ImageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  })

  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-soft transition-shadow ${
        isDragging ? 'z-10 opacity-80 shadow-card ring-2 ring-brand-300' : ''
      }`}
    >
      {/* Per-image toolbar. */}
      <div className="flex items-center justify-center gap-0.5 border-b border-black/5 px-1 py-1">
        <button
          type="button"
          onClick={() => onRotate(image.id, -90)}
          title="Rotate left"
          aria-label={`Rotate image ${position} left`}
          className="icon-btn rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
        >
          <RotateLeftIcon width={16} height={16} />
        </button>
        <button
          type="button"
          onClick={() => onRotate(image.id, 90)}
          title="Rotate right"
          aria-label={`Rotate image ${position} right`}
          className="icon-btn rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
        >
          <RotateIcon width={16} height={16} />
        </button>
        <button
          type="button"
          onClick={() => onEnlarge(image)}
          title="Enlarge"
          aria-label={`Enlarge image ${position}`}
          className="icon-btn rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
        >
          <ExpandIcon width={16} height={16} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(image.id)}
          title="Remove"
          aria-label={`Remove image ${position}`}
          className="icon-btn rounded-lg p-1.5 text-ink-soft hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon width={16} height={16} />
        </button>
      </div>

      {/* Thumbnail, also the drag handle. A square box means a rotated image
          always still fits: rotating a rectangle that fits a square by 90°
          leaves it inside the same square. */}
      <div
        {...attributes}
        {...listeners}
        className="relative flex aspect-square cursor-grab items-center justify-center overflow-hidden bg-cream-soft active:cursor-grabbing"
      >
        <img
          src={image.url}
          alt={image.name}
          style={{ transform: `rotate(${image.rotation}deg)` }}
          className="max-h-full max-w-full object-contain transition-transform"
          draggable={false}
        />
        <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {position}
        </span>
        <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-md bg-white/85 p-1 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
          <DragIcon width={14} height={14} />
        </span>
      </div>

      <p className="truncate border-t border-black/5 px-2 py-1.5 text-[11px] text-ink-faint" title={image.name}>
        {image.name}
      </p>
    </div>
  )
}
