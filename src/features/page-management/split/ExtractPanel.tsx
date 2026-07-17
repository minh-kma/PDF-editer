import { useMemo, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { useStore } from '../../../shared/state/store'
import { extractPdf } from './splitPdf'
import { ExpandIcon } from '../../../shared/components/icons'

interface ExtractPanelProps {
  baseName: string
  onClose: () => void
  onError: (message: string) => void
  /** Hand the extracted PDF back to the app to preview (never auto-download). */
  onExtracted: (bytes: Uint8Array, fileName: string) => void
}

/**
 * Parse a "1-3, 5, 8" style selection into an ordered list of 1-based page
 * positions. Keeps the order the user typed, drops duplicates (first wins) and
 * anything outside 1..total.
 */
function parseSelection(raw: string, total: number): number[] {
  const out: number[] = []
  const seen = new Set<number>()
  const add = (n: number) => {
    if (Number.isInteger(n) && n >= 1 && n <= total && !seen.has(n)) {
      seen.add(n)
      out.push(n)
    }
  }
  for (const token of raw.split(/[,\s]+/)) {
    if (!token) continue
    const range = token.match(/^(\d+)-(\d+)$/)
    if (range) {
      const a = Number.parseInt(range[1], 10)
      const b = Number.parseInt(range[2], 10)
      const step = a <= b ? 1 : -1
      for (let n = a; step > 0 ? n <= b : n >= b; n += step) add(n)
    } else {
      add(Number.parseInt(token, 10))
    }
  }
  return out
}

export function ExtractPanel({ baseName, onClose, onError, onExtracted }: ExtractPanelProps) {
  const { sources, pages, setBusy } = useStore()
  const total = pages.length
  const [raw, setRaw] = useState('')
  const [working, setWorking] = useState(false)

  const selection = useMemo(() => parseSelection(raw, total), [raw, total])

  async function handleExtract() {
    if (selection.length === 0) {
      onError('Choose at least one page to extract.')
      return
    }
    try {
      setWorking(true)
      setBusy(true, 'Extracting pages…')
      const bytes = await extractPdf(sources, pages, selection)
      onExtracted(bytes, `${baseName}_extracted.pdf`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Something went wrong while extracting.')
    } finally {
      setWorking(false)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Extract pages to a new file"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExtract}
            disabled={working || selection.length === 0}
          >
            <ExpandIcon width={18} height={18} />
            Extract {selection.length > 0 ? `${selection.length} ` : ''}
            {selection.length === 1 ? 'page' : 'pages'}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">
        Your document has <strong className="text-ink">{total} pages</strong>. Type the pages you
        want to pull out — they'll be saved as a new file. Your working set stays unchanged.
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        Use commas for single pages and a dash for a range. Example:{' '}
        <code className="rounded bg-cream-soft px-1">1-3, 5, 8</code> keeps pages 1, 2, 3, 5 and 8.
        The order you type is the order they'll appear.
      </p>

      <label className="mt-4 block text-sm font-bold text-ink" htmlFor="extract-pages">
        Pages to extract
      </label>
      <input
        id="extract-pages"
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="e.g. 1-3, 5, 8"
        className="mt-1 w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
      />

      <div className="mt-4 rounded-xl bg-cream-soft p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
          <ExpandIcon width={16} height={16} className="text-brand-500" />
          {selection.length > 0
            ? `Extracting ${selection.length} ${selection.length === 1 ? 'page' : 'pages'}:`
            : 'No pages selected yet.'}
        </p>
        {selection.length > 0 && (
          <p className="text-sm text-ink-soft">Pages {selection.join(', ')}</p>
        )}
        {selection.length === 0 && (
          <p className="text-xs text-ink-faint">
            Enter page numbers above (between 1 and {total}) to choose what to extract.
          </p>
        )}
      </div>
    </Modal>
  )
}
