// Page numbers panel — standalone modal twin of WatermarkPanel. One
// pageNumber DocAnnotation at a time; reopening edits it. `format` uses the
// {n}/{total} tokens the bake substitutes per page.
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../shared/components/Modal'
import { useStore } from '../../../shared/state/store'
import { CheckIcon, TrashIcon } from '../../../shared/components/icons'
import { PageRangeFields, type PageRangeValue } from './PageRangeFields'
import { useFirstPagePreview } from './useFirstPagePreview'
import { NumberField } from './NumberField'
import type { DocAnnotation } from '../../../shared/state/types'

interface PageNumbersPanelProps {
  onClose: () => void
}

const PREVIEW_WIDTH_PX = 280

// These are NOT UI labels: whichever the user picks is stored on the
// DocAnnotation and printed into the output PDF by annotationBake.ts. The
// first two are language-neutral; the third is a real sentence, so it follows
// the UI language ('Trang {n} / {total}' in Vietnamese). Whatever is picked is
// stored verbatim and never re-translated afterwards.
function formats(longFormat: string) {
  return ['{n}', '{n} / {total}', longFormat]
}

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const

export function PageNumbersPanel({ onClose }: PageNumbersPanelProps) {
  const { t } = useTranslation(['docMarks', 'common'])
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
      title={existing ? t('pageNumbers.editTitle') : t('pageNumbers.addTitle')}
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
              {t('pageNumbers.remove')}
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleApply}
            disabled={rangeInvalid}
          >
            <CheckIcon width={18} height={18} />
            {existing ? t('pageNumbers.save') : t('pageNumbers.add')}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-5">
        <div className="min-w-[15rem] flex-1">
          <p className="text-sm font-bold text-ink">{t('pageNumbers.style')}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {formats(t('pageNumbers.longFormat')).map((f) => (
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

          <p className="mt-4 text-sm font-bold text-ink">{t('pageNumbers.position')}</p>
          <div className="mt-1.5 grid w-28 grid-cols-2 gap-1.5">
            {CORNERS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCorner(c)}
                aria-label={t(`pageNumbers.corners.${c}`)}
                aria-pressed={corner === c}
                title={t(`pageNumbers.corners.${c}`)}
                className={`icon-btn flex h-12 items-center justify-center rounded-lg border ${
                  corner === c
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-black/10 bg-white hover:border-brand-200'
                }`}
              >
                {/* A page-shaped sheet with the number's mark in the actual
                    corner, so each of the four reads at a glance. */}
                <span
                  className={`flex h-8 w-6 flex-col rounded-[3px] border p-1 ${
                    c === 'tl' || c === 'tr' ? 'justify-start' : 'justify-end'
                  } ${c === 'tl' || c === 'bl' ? 'items-start' : 'items-end'} ${
                    corner === c ? 'border-brand-400 bg-white' : 'border-ink-faint/50 bg-white'
                  }`}
                >
                  <span
                    className={`h-1 w-2.5 rounded-sm ${
                      corner === c ? 'bg-brand-500' : 'bg-ink-faint'
                    }`}
                  />
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <NumberField
              label={t('pageNumbers.size')}
              min={6}
              max={36}
              fallback={12}
              value={fontSize}
              onChange={setFontSize}
            />
            <NumberField
              label={t('pageNumbers.margin')}
              min={4}
              max={96}
              fallback={24}
              value={margin}
              onChange={setMargin}
            />
            <label className="flex items-center gap-1.5 text-sm text-ink-soft">
              {t('pageNumbers.color')}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label={t('pageNumbers.colorAria')}
                className="h-7 w-7 cursor-pointer rounded-md border border-black/10 p-0.5"
              />
            </label>
          </div>

          <PageRangeFields total={total} value={range} onChange={setRange} />
        </div>

        {/* Live preview on page 1, mirroring how annotationBake places it. */}
        <div className="flex-none">
          <p className="mb-1.5 text-xs font-semibold text-ink-faint">{t('preview')}</p>
          <div
            className="relative overflow-hidden rounded-lg border border-black/10 bg-cream-soft"
            style={{ width: PREVIEW_WIDTH_PX }}
          >
            {url ? (
              <img src={url} alt={t('previewPageAlt')} className="w-full" draggable={false} />
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
