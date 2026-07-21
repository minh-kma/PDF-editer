import { useMemo, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
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
  const { t } = useTranslation(['split', 'common'])
  const { sources, pages, docAnnotations, assets, setBusy } = useStore()
  const total = pages.length
  const [raw, setRaw] = useState('')
  const [working, setWorking] = useState(false)

  const selection = useMemo(() => parseSelection(raw, total), [raw, total])

  async function handleExtract() {
    if (selection.length === 0) {
      onError(t('extract.needPages'))
      return
    }
    try {
      setWorking(true)
      setBusy(true, t('extract.working'))
      const bytes = await extractPdf(sources, pages, selection, { docAnnotations, assets })
      onExtracted(bytes, `${baseName}_extracted.pdf`)
    } catch {
      // Logic-layer errors stay English as diagnostics; show a translated one.
      onError(t('extract.failed'))
    } finally {
      setWorking(false)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('extract.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExtract}
            disabled={working || selection.length === 0}
          >
            <ExpandIcon width={18} height={18} />
            {selection.length > 0
              ? t('extract.button', { count: selection.length })
              : t('extract.buttonEmpty')}
          </button>
        </>
      }
    >
      {/* Trans, not t(): inline markup inside a sentence whose word order
          differs between languages. */}
      <p className="text-sm text-ink-soft">
        <Trans
          i18nKey="extract.intro"
          ns="split"
          count={total}
          components={[<strong className="text-ink" key="count" />]}
        />
      </p>
      <p className="mt-1 text-xs text-ink-faint">
        <Trans
          i18nKey="extract.example"
          ns="split"
          components={[<code className="rounded bg-surface-soft px-1" key="code" />]}
        />
      </p>

      <label className="mt-4 block text-sm font-bold text-ink" htmlFor="extract-pages">
        {t('extract.label')}
      </label>
      <input
        id="extract-pages"
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={t('extract.placeholder')}
        className="mt-1 w-full rounded-xl border border-brand-100 bg-white px-3 py-2.5 font-semibold outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200"
      />

      <div className="mt-4 rounded-xl bg-surface-soft p-3">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
          <ExpandIcon width={16} height={16} className="text-brand-500" />
          {selection.length > 0
            ? t('extract.summary', { count: selection.length })
            : t('extract.noneSelected')}
        </p>
        {selection.length > 0 && (
          <p className="text-sm text-ink-soft">
            {t('extract.selectedPages', { list: selection.join(', ') })}
          </p>
        )}
        {selection.length === 0 && (
          <p className="text-xs text-ink-faint">{t('extract.hint', { max: total })}</p>
        )}
      </div>
    </Modal>
  )
}
