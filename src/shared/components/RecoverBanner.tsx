import { RefreshIcon, CloseIcon } from './icons'

interface RecoverBannerProps {
  savedAt: number
  onRestore: () => void
  onDismiss: () => void
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function RecoverBanner({ savedAt, onRestore, onDismiss }: RecoverBannerProps) {
  return (
    <div className="card flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50 p-4">
      <RefreshIcon width={22} height={22} className="text-brand-500" />
      <div className="flex-1">
        <p className="font-bold text-ink">Restore your previous work?</p>
        <p className="text-sm text-ink-soft">
          We found an editing session from {timeAgo(savedAt)}, saved on this device.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary" onClick={onRestore}>
          Restore
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onDismiss}
          aria-label="Dismiss and start fresh"
        >
          <CloseIcon width={18} height={18} />
          Start fresh
        </button>
      </div>
    </div>
  )
}
