import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TOOL_CATEGORIES, type ToolIntent } from '../lib/toolCatalog'
import { GridIcon, ChevronDownIcon } from './icons'

interface MegaMenuProps {
  onSelect: (intent: ToolIntent) => void
  disabled?: boolean
}

/**
 * "All tools" trigger + dropdown for the persistent AppBar. Built from the
 * same catalog the landing-page used (shared/lib/toolCatalog.ts) — compact
 * rows here instead of large tiles, since this lives in a fixed-height bar
 * rather than a full page.
 */
export function MegaMenu({ onSelect, disabled }: MegaMenuProps) {
  const { t } = useTranslation('appbar')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    // mousedown (not click) so outside clicks close the menu without
    // swallowing a click meant for whatever's underneath. A `fixed inset-0`
    // backdrop doesn't work here: AppBar's `backdrop-blur` header makes it a
    // containing block for `position: fixed` descendants, confining the
    // backdrop to the header's own box instead of the full viewport.
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="appbar-item"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <GridIcon width={18} height={18} />
        {t('allTools')}
        <ChevronDownIcon width={14} height={14} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,46rem)] rounded-2xl border border-black/5 bg-white p-3 shadow-card"
        >
          {/* A fixed column per category, in catalog order: Organize PDF,
              Optimize PDF, Edit PDF, Security, Convert. Fixed (not auto-fit) so
              every category — including short ones like Convert — always gets
              its own column instead of wrapping underneath a taller neighbour.
              Falls back to two columns on phones, where five don't fit. */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
            {TOOL_CATEGORIES.map((category) => (
              <div key={category.headingKey}>
                <h3 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                  {t(category.headingKey)}
                </h3>
                <div className="mt-1 space-y-0.5">
                  {category.tools.map((tool) => (
                    <button
                      key={tool.intent}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(false)
                        onSelect(tool.intent)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-brand-50"
                    >
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-brand-100 text-brand-500">
                        <tool.icon width={13} height={13} />
                      </span>
                      <span className="text-sm font-semibold text-ink">{t(tool.labelKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
