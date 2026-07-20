// Page numbers panel — standalone modal twin of WatermarkPanel. One
// pageNumber DocAnnotation at a time; reopening edits it. `format` uses the
// {n}/{total} tokens the bake substitutes per page.
import { useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { useStore } from '../../../shared/state/store'
import { CheckIcon, TrashIcon } from '../../../shared/components/icons'
import { PageRangeFields, type PageRangeValue } from './PageRangeFields'
import { useFirstPagePreview } from './useFirstPagePreview'
import type { DocAnnotation } from '../../../shared/state/types'

interface PageNumbersPanelProps {
  onClose: () => void
}

const PREVIEW_WIDTH_PX = 280

const FORMATS = ['{n}', '{n} / {total}', 'Page {n} of {total}']

const CORNERS: { corner: 'tl' | 'tr' | 'bl' | 'br'; label: string }[] = [
  { corner: 'tl', label: 'Top left' },
  { corner: 'tr', label: 'Top right' },
  { corner: 'bl', label: 'Bottom left' },
  { corner: 'br', label: 'Bottom right' },
]

export function PageNumbersPanel({ onClose }: PageNumbersPanelProps) {
  const { pages, docAnnotations, addDocAnnotation, updateDocAnnotation, deleteDocAnnotation } =
    useStore()
  const existing = docAnnotations.find((d) => d.type === 'pageNumber')
  const total = pages.length

  const [format, setFormat] = useState(existing?.format ?? '{n} / {total}')
  const [corner, setCorner] = useState<'tl' | 'tr' | 'bl' | 'br'>(existing?.corner ?? 'br')
  const [margin, setMargin] = useState(existing?.margin ?? 24)
  const [fontSize, setFontSize] = useState(existing?.fontSize ?? 12)
  const [color, setColor] = useState(existing?.color ?? '#666666')
  const [range, setRange] = useState<PageRangeValue>(
    existing?.range
      ? { mode: 'custom', from: existing.range.from, to: existing.range.to }
      : { mode: 'all', from: 1, to: total },
  )
  const { url, displayedPt } = useFirstPagePreview()

  const rangeInvalid = range.mode === 'custom' && range.from > range.to

  function handleApply() {
    const d: DocAnnotation = {
      id: existing?.id ?? crypto.randomUUID(),
      type: 'pageNumber',
      format,
      corner,
      margin,
      fontSize,
      color,
      ...(range.mode === 'custom' ? { range: { from: range.from, to: range.to } } : {}),
    }
    if (existing) updateDocAnnotation(d)
    else addDocAnnotation(d)
    onClose()
  }

  function handleRemove() {
    if (existing) deleteDocAnnotation(existing.id)
    onClose()
  }

  const scale = displayedPt ? PREVIEW_WIDTH_PX / displayedPt.width : 0
  const sample = format.replace('{n}', '1').replace('{total}', String(total))
  const marginPx = margin * scale

  return (
    <Modal
      title={existing ? 'Edit page numbers' : 'Add page numbers'}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <button
              type="button"
              className="btn-ghost mr-auto text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleRemove}
            >
              <TrashIcon width={16} height={16} />
              Remove page numbers
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleApply}
            disabled={rangeInvalid}
          >
            <CheckIcon width={18} height={18} />
            {existing ? 'Save changes' : 'Add page numbers'}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-5">
        <div className="min-w-[15rem] flex-1">
          <p className="text-sm font-bold text-ink">Style</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${
                  format === f
                    ? 'border-brand-300 bg-brand-50 text-brand-600'
                    : 'border-black/10 bg-white text-ink-soft hover:border-brand-200'
                }`}
              >
                {f.replace('{n}', '1').replace('{total}', String(total))}
              </button>
            ))}
          </div>

          <p className="mt-4 text-sm font-bold text-ink">Position</p>
          <div className="mt-1.5 grid w-24 grid-cols-2 gap-1">
            {CORNERS.map(({ corner: c, label }) => (
              <button
                key={c}
                type="button"
                onClick={() => setCorner(c)}
                aria-label={label}
                aria-pressed={corner === c}
                title={label}
                className={`icon-btn flex h-10 items-center rounded-lg border p-1.5 ${
                  c === 'tl' || c === 'bl' ? 'justify-start' : 'justify-end'
                } ${c === 'tl' || c === 'tr' ? 'items-start' : 'items-end'} ${
                  corner === c
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-black/10 bg-white hover:border-brand-200'
                }`}
              >
                <span
                  className={`h-1.5 w-3 rounded-sm ${corner === c ? 'bg-brand-500' : 'bg-ink-faint'}`}
                />
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <label className="flex items-center gap-1.5 text-sm text-ink-soft">
              Size
              <input
                type="number"
                min={6}
                max={36}
                value={fontSize}
                onChange={(e) => setFontSize(Math.min(36, Math.max(6, Number(e.target.value) || 12)))}
                className="w-16 rounded-lg border border-brand-100 bg-white px-2 py-1 text-center font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink-soft">
              Margin
              <input
                type="number"
                min={4}
                max={96}
                value={margin}
                onChange={(e) => setMargin(Math.min(96, Math.max(4, Number(e.target.value) || 24)))}
                className="w-16 rounded-lg border border-brand-100 bg-white px-2 py-1 text-center font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <label className="flex items-center gap-1.5 text-sm text-ink-soft">
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Page number color"
                className="h-7 w-7 cursor-pointer rounded-md border border-black/10 p-0.5"
              />
            </label>
          </div>

          <PageRangeFields total={total} value={range} onChange={setRange} />
        </div>

        {/* Live preview on page 1, mirroring how annotationBake places it. */}
        <div className="flex-none">
          <p className="mb-1.5 text-xs font-semibold text-ink-faint">Preview (page 1)</p>
          <div
            className="relative overflow-hidden rounded-lg border border-black/10 bg-cream-soft"
            style={{ width: PREVIEW_WIDTH_PX }}
          >
            {url ? (
              <img src={url} alt="Page 1" className="w-full" draggable={false} />
            ) : (
              <div className="flex h-72 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
              </div>
            )}
            {url && scale > 0 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  ...(corner === 'tl' || corner === 'bl' ? { left: marginPx } : { right: marginPx }),
                  ...(corner === 'tl' || corner === 'tr' ? { top: marginPx } : { bottom: marginPx }),
                  fontSize: fontSize * scale,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  color,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {sample}
              </span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
