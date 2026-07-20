import { useTranslation } from 'react-i18next'

interface BusyOverlayProps {
  message: string
}

export function BusyOverlay({ message }: BusyOverlayProps) {
  const { t } = useTranslation('common')

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
      <div className="card flex flex-col items-center gap-3 px-8 py-6">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-500" />
        <p className="font-bold text-ink">{message || t('working')}</p>
      </div>
    </div>
  )
}
