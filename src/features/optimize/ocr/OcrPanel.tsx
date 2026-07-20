import { useRef, useState } from 'react'
import { Modal } from '../../../shared/components/Modal'
import { ProgressBar } from '../../../shared/components/ProgressBar'
import { useStore } from '../../../shared/state/store'
import { buildPdf } from '../../page-management/workspace/buildPdf'
import { ocrDocument, OCR_SPEED_DISCLOSURE, type OcrProgressInfo } from './ocrDocument'
import { bakeOcrTextLayer } from './bakeOcrTextLayer'
import { ShieldIcon, ScanIcon } from '../../../shared/components/icons'

interface OcrPanelProps {
  baseName: string
  onClose: () => void
  onError: (message: string) => void
  /** Hand the searchable PDF back to the app to preview (never auto-download). */
  onDone: (bytes: Uint8Array, fileName: string) => void
}

// D24: language picker limited to English and Vietnamese. Tesseract language
// codes — ocrDocument.ts joins these with '+' for a multi-language pass.
const LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'vie', label: 'Vietnamese' },
]

type Phase = 'config' | 'running'

/**
 * OCR tool panel: (a) disclosure + language picker, (b) recognition progress,
 * (c) bake the searchable text layer and hand off to the app's PreviewModal.
 * ocrDocument.ts/bakeOcrTextLayer.ts are already-verified logic (D7) — this
 * component only sequences and displays them, no changes to either.
 */
export function OcrPanel({ baseName, onClose, onError, onDone }: OcrPanelProps) {
  const { sources, pages, docAnnotations, assets } = useStore()
  const [phase, setPhase] = useState<Phase>('config')
  const [languages, setLanguages] = useState<string[]>(['eng'])
  const [progress, setProgress] = useState<OcrProgressInfo | null>(null)
  const [finishing, setFinishing] = useState(false)

  // OCR can run long; if the user closes the panel mid-run, the in-flight
  // recognition can't be aborted (ocrDocument has no cancellation hook), but
  // its eventual result must not surprise-open a PreviewModal after the user
  // already backed out. This flag makes that result a silent no-op instead.
  const cancelledRef = useRef(false)

  function handleClose() {
    cancelledRef.current = true
    onClose()
  }

  function toggleLanguage(code: string) {
    setLanguages((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  async function handleStart() {
    if (languages.length === 0) return
    setPhase('running')
    try {
      const assembled = await buildPdf(sources, pages, { docAnnotations, assets })
      const results = await ocrDocument(assembled, { languages, onProgress: setProgress })
      if (cancelledRef.current) return

      setFinishing(true)
      const baked = await bakeOcrTextLayer(assembled, results)
      if (cancelledRef.current) return

      onDone(baked, `${baseName}_ocr.pdf`)
    } catch (err) {
      if (cancelledRef.current) return
      onError(err instanceof Error ? err.message : 'Something went wrong while running OCR.')
    }
  }

  // How many pages are fully done (skipped or recognized) — a page that's
  // currently 'recognizing' doesn't count yet, so the bar doesn't jump to
  // 100% one page early.
  const completed = progress
    ? progress.status === 'recognizing'
      ? progress.pageIndex
      : progress.pageIndex + 1
    : 0

  return (
    <Modal
      title="OCR — make scanned pages searchable"
      onClose={handleClose}
      footer={
        phase === 'config' ? (
          <>
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleStart}
              disabled={languages.length === 0}
            >
              <ScanIcon width={18} height={18} />
              Start OCR
            </button>
          </>
        ) : (
          <button type="button" className="btn-secondary" onClick={handleClose}>
            Cancel
          </button>
        )
      }
    >
      {phase === 'config' ? (
        <>
          <p className="text-sm text-ink-soft">{OCR_SPEED_DISCLOSURE}</p>

          <p className="mt-4 text-sm font-bold text-ink">Document language</p>
          <p className="text-xs text-ink-faint">Pick the language(s) this document is written in.</p>
          <div className="mt-2 space-y-2">
            {LANGUAGES.map((lang) => (
              <label
                key={lang.code}
                className="flex items-center gap-2.5 rounded-xl border border-brand-100 bg-white px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={languages.includes(lang.code)}
                  onChange={() => toggleLanguage(lang.code)}
                  className="h-4 w-4 accent-brand-500"
                />
                <span className="text-sm font-semibold text-ink">{lang.label}</span>
              </label>
            ))}
          </div>
          {languages.length === 0 && (
            <p className="mt-1.5 text-xs font-semibold text-red-600">Pick at least one language.</p>
          )}

          <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-faint">
            <ShieldIcon width={14} height={14} className="mt-0.5 flex-none text-brand-400" />
            Nothing is uploaded to any server.
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-6">
          <ProgressBar value={completed} max={progress?.pageCount ?? pages.length} className="max-w-sm" />
          <p className="text-sm font-semibold text-ink-soft">
            {finishing
              ? 'Finishing up…'
              : progress
                ? `Page ${progress.pageIndex + 1} of ${progress.pageCount} — ${
                    progress.status === 'skipped' ? 'already has text, skipping…' : 'recognizing…'
                  }`
                : 'Starting…'}
          </p>
        </div>
      )}
    </Modal>
  )
}
