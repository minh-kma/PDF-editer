import { useEffect, useState } from 'react'
import { TOOL_CATEGORIES, type ToolIntent } from '../lib/toolCatalog'
import { GridIcon, ChevronDownIcon } from './icons'

interface MegaMenuProps {
  onSelect: (intent: ToolIntent) => void
  disabled?: boolean
}

/**
 * "All tools" trigger + dropdown for the persistent AppBar. Built from the
 * same catalog the landing-page ToolGrid uses (shared/lib/toolCatalog.ts) —
 * compact rows here instead of ToolGrid's large tiles, since this lives in
 * a fixed-height bar rather than a full page.
 */
export function MegaMenu({ onSelect, disabled }: MegaMenuProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <GridIcon width={18} height={18} />
        All tools
        <ChevronDownIcon width={14} height={14} />
      </button>

      {open && (
        <>
          {/* Click-outside-to-close backdrop, same pattern as Modal.tsx. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-2 w-[min(90vw,640px)] rounded-2xl border border-black/5 bg-white p-4 shadow-card"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {TOOL_CATEGORIES.map((category) => (
                <div key={category.heading}>
                  <h3 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                    {category.heading}
                  </h3>
                  <div className="mt-2 space-y-1">
                    {category.tools.map((tool) => (
                      <button
                        key={tool.intent}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setOpen(false)
                          onSelect(tool.intent)
                        }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-brand-50"
                      >
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-brand-100 text-brand-500">
                          <tool.icon width={15} height={15} />
                        </span>
                        <span className="text-sm font-semibold text-ink">{tool.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
