import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Modal } from '../../../shared/components/Modal'
import { useStore } from '../../../shared/state/store'
import { splitPdf, type SplitRange } from './splitPdf'
import { downloadBlob } from '../../../shared/lib/download'
import { DownloadIcon, ScissorsIcon } from '../../../shared/components/icons'

interface SplitPanelProps {
  baseName: string
  onClose: () => void
  onError: (message: string) => void
}

/** Turn user-entered split points into inclusive ranges over 1..total. */
function buildRanges(points: number[], total: number): SplitRange[] {
  const clean = Array.from(new Set(points))
    .filter((p) => Number.isInteger(p) && p >= 1 && p < total)
    .sort((a, b) => a - b)

  const ranges: SplitRange[] = []
  let start = 1
  for (const p of clean) {
    ranges.push({ start, end: p })
    start = p + 1
  }
  ranges.push({ start, end: total })
  return ranges
}

export function SplitPanel({ baseName, onClose, onError }: SplitPanelProps) {
  const { sources, pages, annotations, docAnnotations, assets, setBusy } = useStore()
  const total = pages.length
  const [raw, setRaw] = useState('')
  const [working, setWorking] = useState(false)

  // Parse the "3, 7" style input into numbers.
  const points = useMemo(
    () =>
      raw
        .split(/[,\s]+/)
        .map((s) => Number.parseInt(s, 10))
        .filter((n) => !Number.isNaN(n)),
    [raw],
  )

  const ranges = useMemo(() => buildRanges(points, total), [points, total])
  const invalid = points.filter((p) => p < 1 || p >= total)

  async function handleSplit() {
    if (ranges.length < 2) {
      onError('Add at least one split point to divide the PDF into 2 or more files.')
      return
    }
    try {
      setWorking(true)
      setBusy(true, 'Splitting your PDF…')
      const parts = await splitPdf(sources, pages, ranges, baseName, {
        annotations,
        docAnnotations,
        assets,
      })
      const zip = new JSZip()
      for (const part of parts) zip.file(part.name, part.bytes)
      const blob = await zip.generateAsync({ type: 'blob' })
      downloadBlob(blob, `${baseName}_split.zip`)
      onClose()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Something went wrong while splitting.')
    } finally {
      setWorking(false)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Split into separate files"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSplit}
            disabled={working || ranges.length < 2}
          >
            <DownloadIcon width={18} height={18} />
            Split &amp; download .zip
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        Your document has <strong className="text-ink">{total} pages</strong>. Type the page
        numbers where a <em>new file</em> should start after.
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Example: entering <code className="rounded bg-cream-soft px-1">3, 7</code> on a 10-page PDF
        makes 3 files: pages 1–3, 4–7 and 8–10.
      </p>

      <label className="mt-4 block text-sm font-bold text-ink" htmlFor="split-points">
        Split after page(s)
      </label>
      <input
        id="split-points"
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="e.g. 3, 7"
        className="mt-1 w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
      />
      {invalid.length > 0 && (
        <p className="mt-1.5 text-xs font-semibold text-red-600">
          Ignoring {invalid.join(', ')} — split points must be between 1 and {total - 1}.
        </p>
      )}

      <div className="mt-4 rounded-xl bg-cream-soft p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
          <ScissorsIcon width={16} height={16} className="text-brand-500" />
          This will create {ranges.length} {ranges.length === 1 ? 'file' : 'files'}:
        </p>
        <ul className="space-y-1 text-sm text-ink-soft">
          {ranges.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-brand-100 text-[11px] font-bold text-brand-600">
                {i + 1}
              </span>
              {r.start === r.end ? `Page ${r.start}` : `Pages ${r.start}–${r.end}`}
              <span className="text-xs text-ink-faint">
                ({r.end - r.start + 1} {r.end - r.start + 1 === 1 ? 'page' : 'pages'})
              </span>
            </li>
          ))}
        </ul>
        {ranges.length < 2 && (
          <p className="mt-2 text-xs text-ink-faint">
            Add at least one split point above to divide the file.
          </p>
        )}
      </div>
    </Modal>
  )
}
