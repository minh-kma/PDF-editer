import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    // Prevent the page behind from scrolling while the modal is open.
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`card flex max-h-[90vh] w-full flex-col overflow-hidden ${
          wide ? 'max-w-4xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/5 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
