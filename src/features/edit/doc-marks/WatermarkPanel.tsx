// Watermark panel — a standalone modal (same pattern as Split/Protect), NOT a
// per-page canvas tool. Dispatches addDocAnnotation/updateDocAnnotation/
// deleteDocAnnotation directly; the bake pipeline draws it on export. Only one
// watermark exists at a time — reopening the panel edits it.
import { useMemo, useRef, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { useStore } from '../../../shared/state/store'
import { CheckIcon, TrashIcon } from '../../../shared/components/icons'
import { PageRangeFields, type PageRangeValue } from './PageRangeFields'
import { useFirstPagePreview } from './useFirstPagePreview'
import { NumberField } from './NumberField'
import type { Asset, DocAnnotation } from '../../../shared/state/types'

interface WatermarkPanelProps {
  onClose: () => void
}

const PREVIEW_WIDTH_PX = 280

export function WatermarkPanel({ onClose }: WatermarkPanelProps) {
  const {
    pages,
    docAnnotations,
    assets,
    addDocAnnotation,
    updateDocAnnotation,
    deleteDocAnnotation,
    addAsset,
  } = useStore()
  const existing = docAnnotations.find((d) => d.type === 'watermark')
  const total = pages.length

  const [tab, setTab] = useState<'text' | 'image'>(existing?.assetId ? 'image' : 'text')
  const [text, setText] = useState(existing?.text ?? '')
  const [fontSize, setFontSize] = useState(existing?.fontSize ?? 48)
  const [color, setColor] = useState(existing?.color ?? '#888888')
  const [opacityPct, setOpacityPct] = useState(Math.round((existing?.opacity ?? 0.15) * 100))
  const [rotationDeg, setRotationDeg] = useState(existing?.rotationDeg ?? 45)
  const [assetId, setAssetId] = useState<string | undefined>(existing?.assetId)
  const [range, setRange] = useState<PageRangeValue>(
    existing?.range
      ? { mode: 'custom', from: existing.range.from, to: existing.range.to }
      : { mode: 'all', from: 1, to: total },
  )
  const fileInput = useRef<HTMLInputElement>(null)
  const { url, displayedPt, pageRotation } = useFirstPagePreview()

  // Temporary object URL for the uploaded image, both for the preview and to
  // confirm the pick. Keyed by assetId so it refreshes when a new file lands.
  const assetUrl = useMemo(() => {
    const asset = assetId ? assets[assetId] : undefined
    if (!asset) return null
    const copy = asset.bytes.slice()
    return URL.createObjectURL(new Blob([copy], { type: asset.mimeType }))
  }, [assetId, assets])

  async function handlePickImage(file: File) {
    const mimeType: Asset['mimeType'] = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const bytes = new Uint8Array(await file.arrayBuffer())
    setAssetId(addAsset(bytes, mimeType))
  }

  const rangeInvalid = range.mode === 'custom' && range.from > range.to
  const canApply = (tab === 'text' ? text.trim().length > 0 : !!assetId) && !rangeInvalid

  function handleApply() {
    const d: DocAnnotation = {
      id: existing?.id ?? crypto.randomUUID(),
      type: 'watermark',
      opacity: opacityPct / 100,
      ...(tab === 'text'
        ? { text: text.trim(), fontSize, color, rotationDeg }
        : { assetId }),
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

  // Preview scale: the preview image is PREVIEW_WIDTH_PX wide for a page that
  // is displayedPt.width points wide.
  const scale = displayedPt ? PREVIEW_WIDTH_PX / displayedPt.width : 0

  return (
    <Modal
      title={existing ? 'Edit watermark' : 'Add a watermark'}
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
              Remove watermark
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleApply} disabled={!canApply}>
            <CheckIcon width={18} height={18} />
            {existing ? 'Save changes' : 'Add watermark'}
          </button>
        </>
      }
    >
      <div className="flex flex-wrap gap-5">
        <div className="min-w-[15rem] flex-1">
          <div className="flex items-center gap-1 rounded-lg bg-cream-soft p-1">
            <button
              type="button"
              onClick={() => setTab('text')}
              aria-pressed={tab === 'text'}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-sm font-semibold ${
                tab === 'text' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint'
              }`}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setTab('image')}
              aria-pressed={tab === 'image'}
              className={`flex-1 rounded-md px-2.5 py-1.5 text-sm font-semibold ${
                tab === 'image' ? 'bg-white text-ink shadow-sm' : 'text-ink-faint'
              }`}
            >
              Image
            </button>
          </div>

          {tab === 'text' ? (
            <>
              <label className="mt-4 block text-sm font-bold text-ink" htmlFor="watermark-text">
                Watermark text
              </label>
              <input
                id="watermark-text"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g. CONFIDENTIAL"
                className="mt-1 w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
              />

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
                <NumberField
                  label="Size"
                  min={8}
                  max={144}
                  fallback={48}
                  value={fontSize}
                  onChange={setFontSize}
                />
                <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                  Color
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    aria-label="Watermark color"
                    className="h-7 w-7 cursor-pointer rounded-md border border-black/10 p-0.5"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                  Angle
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    value={rotationDeg}
                    onChange={(e) => setRotationDeg(Number(e.target.value))}
                    aria-label="Watermark angle"
                    className="w-24"
                  />
                  <span className="w-9 text-right text-xs font-semibold tabular-nums">{rotationDeg}°</span>
                </label>
              </div>
            </>
          ) : (
            <div className="mt-4">
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void handlePickImage(file)
                }}
              />
              <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
                {assetId ? 'Choose a different image' : 'Choose an image (PNG or JPG)'}
              </button>
              {assetUrl && (
                <img
                  src={assetUrl}
                  alt="Watermark preview"
                  className="mt-3 max-h-24 rounded-lg border border-black/10 object-contain"
                />
              )}
            </div>
          )}

          <label className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft">
            Opacity
            <input
              type="range"
              min={5}
              max={100}
              value={opacityPct}
              onChange={(e) => setOpacityPct(Number(e.target.value))}
              aria-label="Watermark opacity"
              className="w-24"
            />
            <span className="w-9 text-right text-xs font-semibold tabular-nums">{opacityPct}%</span>
          </label>

          <PageRangeFields total={total} value={range} onChange={setRange} />
        </div>

        {/* Live preview on page 1, mirroring how annotationBake draws it. */}
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
            {url && scale > 0 && tab === 'text' && text.trim() && (
              // Mirrors the bake: baseline starts at ((W-tw)/2, H/2), rotated
              // about that start point; the page's own rotation adds on top.
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -100%) rotate(${pageRotation - rotationDeg}deg)`,
                  transformOrigin: 'left bottom',
                  fontSize: fontSize * scale,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  color,
                  opacity: opacityPct / 100,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {text.trim()}
              </span>
            )}
            {url && tab === 'image' && assetUrl && (
              // Mirrors the bake: image centered, half the page width.
              <img
                src={assetUrl}
                alt=""
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '25%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '50%',
                  opacity: opacityPct / 100,
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
