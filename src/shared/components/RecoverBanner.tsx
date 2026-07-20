import { useTranslation } from 'react-i18next'
import { RefreshIcon, CloseIcon } from './icons'

interface RecoverBannerProps {
  savedAt: number
  onRestore: () => void
  onDismiss: () => void
}

/**
 * "5 minutes ago" in the active language. The minute/hour/day bucketing is the
 * same as before; only the formatting is delegated to Intl, which knows the
 * Vietnamese wording (and every other locale's) so we don't hand-build plurals.
 */
function useTimeAgo(ts: number): string {
  const { t, i18n } = useTranslation('landing')
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return t('recover.justNow')

  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'always' })
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return rtf.format(-hrs, 'hour')
  return rtf.format(-Math.round(hrs / 24), 'day')
}

export function RecoverBanner({ savedAt, onRestore, onDismiss }: RecoverBannerProps) {
  const { t } = useTranslation('landing')
  const time = useTimeAgo(savedAt)

  return (
    <div className="card flex flex-wrap items-center gap-3 border-brand-200 bg-brand-50 p-4">
      <RefreshIcon width={22} height={22} className="text-brand-500" />
      <div className="flex-1">
        <p className="font-bold text-ink">{t('recover.title')}</p>
        <p className="text-sm text-ink-soft">{t('recover.body', { time })}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-primary" onClick={onRestore}>
          {t('recover.restore')}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={onDismiss}
          aria-label={t('recover.dismissAria')}
        >
          <CloseIcon width={18} height={18} />
          {t('recover.startFresh')}
        </button>
      </div>
    </div>
  )
}
