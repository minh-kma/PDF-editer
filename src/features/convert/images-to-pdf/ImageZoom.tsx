// Enlarge one staged image. Mirrors PageZoom's modal chrome (backdrop,
// Esc-to-close, scroll-lock) without importing it — that one renders a pdf.js
// page from a sibling module.
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { ImageItem } from './useImageList'

interface ImageZoomProps {
  image: ImageItem
  onClose: () => void
}

export function ImageZoom({ image, onClose }: ImageZoomProps) {
  const { t } = useTranslation('imagesToPdf')

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
      aria-label={t('card.enlargedViewAria', { name: image.name })}
    >
      <div className="flex min-h-full min-w-full flex-col items-center justify-center gap-3 p-4 sm:p-8">
        <img
          src={image.url}
          alt={image.name}
          onClick={(e) => e.stopPropagation()}
          style={{ transform: `rotate(${image.rotation}deg)` }}
          className="max-h-[78vh] max-w-[78vmin] rounded-lg object-contain shadow-2xl"
          draggable={false}
        />
        <p className="max-w-full truncate px-4 text-sm font-semibold text-white/90">{image.name}</p>
      </div>
    </div>
  )
}
