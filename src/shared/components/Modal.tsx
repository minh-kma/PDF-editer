import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** Fill (almost) the whole viewport instead of a centered card. */
  fullscreen?: boolean
  /** Optional control rendered in the header, left of the close button. */
  headerAction?: ReactNode
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  fullscreen,
  headerAction,
}: ModalProps) {
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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 ${
        fullscreen ? 'p-0 sm:p-3' : 'p-4'
      }`}
      onClick={onClose}
    >
      <div
        className={`card flex flex-col overflow-hidden ${
          fullscreen
            ? 'h-full w-full max-w-none rounded-none sm:rounded-2xl'
            : `max-h-[90vh] w-full ${wide ? 'max-w-[61.6rem]' : 'max-w-lg'}`
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <div className="flex items-center gap-1">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="icon-btn rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
            >
              <CloseIcon width={20} height={20} />
            </button>
          </div>
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
