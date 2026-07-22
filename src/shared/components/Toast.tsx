import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CloseIcon } from './icons'

interface ToastProps {
  message: string
  onClose: () => void
}

export function Toast({ message, onClose }: ToastProps) {
  const { t } = useTranslation('common')

  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [message, onClose])

  return (
    <div className="fixed bottom-4 left-1/2 z-[70] w-[92%] max-w-md -translate-x-1/2">
      <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-white px-4 py-3 shadow-card">
        <div className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
          !
        </div>
        <p className="flex-1 text-sm font-semibold text-ink">{message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('dismiss')}
          className="icon-btn rounded-lg p-1 text-ink-faint hover:text-ink"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
    </div>
  )
}
