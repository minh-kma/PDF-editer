// English/Vietnamese switcher for the AppBar. Picking a language navigates
// between the two static homepages (/ and /vi/) — a real URL change, so the
// crawlable page and the UI language stay in sync — rather than only toggling
// in-memory state. The full page load re-runs i18n init, which reads the new
// path; i18next's detector cache also writes the choice to localStorage, so it
// sticks across visits and beats the browser locale from then on.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, homepageUrlForLanguage, type SupportedLanguage } from '../i18n'
import { GlobeIcon, ChevronDownIcon, CheckIcon } from './icons'

interface LanguageSwitcherProps {
  disabled?: boolean
}

const LABEL_KEYS: Record<SupportedLanguage, 'languageEnglish' | 'languageVietnamese'> = {
  en: 'languageEnglish',
  vi: 'languageVietnamese',
}

export function LanguageSwitcher({ disabled }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation('appbar')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Same close mechanics as MegaMenu: Escape, plus mousedown (not click) on the
  // outside so the click still reaches whatever is underneath. Note the panel
  // is absolutely positioned — a `fixed inset-0` backdrop would be confined to
  // the header's box, because AppBar's backdrop-blur makes it a containing
  // block for fixed descendants (see MegaMenu.tsx).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  const current = (SUPPORTED_LANGUAGES as readonly string[]).includes(i18n.language)
    ? (i18n.language as SupportedLanguage)
    : 'en'

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label={t('language')}
        title={t('language')}
        aria-expanded={open}
        aria-haspopup="true"
        className="icon-btn flex items-center gap-1 rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <GlobeIcon width={18} height={18} />
        <span className="text-sm font-bold uppercase">{current}</span>
        <ChevronDownIcon width={14} height={14} className="hidden sm:block" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-44 rounded-xl border border-black/5 bg-white p-1.5 shadow-card"
        >
          {SUPPORTED_LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                if (code !== current) {
                  window.location.assign(homepageUrlForLanguage(code))
                }
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-brand-50 ${
                code === current ? 'text-brand-600' : 'text-ink'
              }`}
            >
              <CheckIcon
                width={15}
                height={15}
                className={code === current ? 'text-brand-500' : 'invisible'}
              />
              {t(LABEL_KEYS[code])}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
