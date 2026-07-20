// Shared "which pages does this apply to" picker for the doc-level panels
// (Watermark / Page numbers) — maps to DocAnnotation.range (omitted = all).

export interface PageRangeValue {
  mode: 'all' | 'custom'
  from: number
  to: number
}

interface PageRangeFieldsProps {
  total: number
  value: PageRangeValue
  onChange: (value: PageRangeValue) => void
}

/** Clamp a 1-based page number into 1..total (NaN becomes the fallback). */
function clampPage(raw: string, total: number, fallback: number): number {
  const n = Number.parseInt(raw, 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(total, Math.max(1, n))
}

export function PageRangeFields({ total, value, onChange }: PageRangeFieldsProps) {
  return (
    <div className="mt-4">
      <p className="text-sm font-bold text-ink">Apply to</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg bg-cream-soft p-1">
          <button
            type="button"
            onClick={() => onChange({ ...value, mode: 'all' })}
            aria-pressed={value.mode === 'all'}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              value.mode === 'all' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint'
            }`}
          >
            All pages
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...value, mode: 'custom' })}
            aria-pressed={value.mode === 'custom'}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
              value.mode === 'custom' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint'
            }`}
          >
            Page range
          </button>
        </div>

        {value.mode === 'custom' && (
          <label className="flex items-center gap-1.5 text-sm text-ink-soft">
            from
            <input
              type="number"
              min={1}
              max={total}
              value={value.from}
              onChange={(e) => onChange({ ...value, from: clampPage(e.target.value, total, 1) })}
              aria-label="First page"
              className="w-16 rounded-lg border border-brand-100 bg-white px-2 py-1 text-center font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
            />
            to
            <input
              type="number"
              min={1}
              max={total}
              value={value.to}
              onChange={(e) => onChange({ ...value, to: clampPage(e.target.value, total, total) })}
              aria-label="Last page"
              className="w-16 rounded-lg border border-brand-100 bg-white px-2 py-1 text-center font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
            />
          </label>
        )}
      </div>
      {value.mode === 'custom' && value.from > value.to && (
        <p className="mt-1 text-xs font-semibold text-red-600">
          The first page must come before the last page.
        </p>
      )}
    </div>
  )
}
