import { TOOL_CATEGORIES, type ToolIntent } from '../lib/toolCatalog'

export type { ToolIntent }

interface ToolGridProps {
  onSelect: (intent: ToolIntent) => void
  disabled?: boolean
}

/**
 * Landing-page tool discovery. Presentational: it renders the catalog and
 * reports which tool the user picked; App decides how to route that intent
 * into the upload flow. Catalog data lives in shared/lib/toolCatalog.ts,
 * shared with the persistent bar's MegaMenu (shared/components/MegaMenu.tsx).
 */
export function ToolGrid({ onSelect, disabled }: ToolGridProps) {
  return (
    <div className="mt-10">
      <p className="text-center text-sm text-ink-soft">
        Or pick a tool to get started — we’ll ask for your file next.
      </p>

      {TOOL_CATEGORIES.map((category) => (
        <section key={category.heading} className="mt-6">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
            {category.heading}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {category.tools.map((tool) => (
              <button
                key={tool.intent}
                type="button"
                onClick={() => onSelect(tool.intent)}
                disabled={disabled}
                className="flex items-start gap-3 rounded-xl border border-brand-100 bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-100 text-brand-500">
                  <tool.icon width={18} height={18} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{tool.label}</span>
                  <span className="block text-xs text-ink-faint">{tool.description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
