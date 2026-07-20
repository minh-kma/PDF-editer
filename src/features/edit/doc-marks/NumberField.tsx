// Labelled number input shared by the doc-marks panels (watermark Size, page
// numbers Size/Margin). While focused it holds a free-form string, so it can
// be cleared and retyped; the value is parsed and clamped on Enter or blur,
// falling back to `fallback` if what's left isn't a number.
import { useState } from 'react'
import type { KeyboardEvent } from 'react'

interface NumberFieldProps {
  label: string
  value: number
  min: number
  max: number
  /** Used when the field is committed empty or unparsable. */
  fallback: number
  onChange: (value: number) => void
}

export function NumberField({ label, value, min, max, fallback, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    const n = parseFloat((draft ?? '').trim())
    onChange(Math.min(max, Math.max(min, Number.isFinite(n) ? n : fallback)))
    setDraft(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      setDraft(null)
      e.currentTarget.blur()
    }
  }

  return (
    <label className="flex items-center gap-1.5 text-sm text-ink-soft">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setDraft(String(value))}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="w-16 rounded-lg border border-brand-100 bg-white px-2 py-1 text-center font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
      />
    </label>
  )
}
