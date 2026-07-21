// Compress tool panel: pick a level, watch per-image progress, hand the result
// to the app's PreviewModal (never auto-download). Same two-phase shape as
// OcrPanel — the other long-running tool.
//
// The before/after and "never bigger than what you started with" logic lives
// here rather than in App.tsx: it's compress-specific, and it needs the level
// the user picked.
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../shared/components/Modal'
import { ProgressBar } from '../../../shared/components/ProgressBar'
import { useStore } from '../../../shared/state/store'
import { buildPdf } from '../workspace/buildPdf'
import { compressPdf, type CompressLevel } from './compressPdf'
import { formatBytes } from '../../../shared/lib/format'
import { ShieldIcon, CompressIcon } from '../../../shared/components/icons'

interface CompressPanelProps {
  baseName: string
  onClose: () => void
  onError: (message: string) => void
  /** Hand the compressed PDF back to the app to preview. */
  onDone: (bytes: Uint8Array, fileName: string, info: ReactNode) => void
}

const LEVELS: CompressLevel[] = ['low', 'medium', 'high']

type Phase = 'config' | 'running'

export function CompressPanel({ baseName, onClose, onError, onDone }: CompressPanelProps) {
  const { t } = useTranslation(['compress', 'common'])
  const { sources, pages, docAnnotations, assets } = useStore()
  const [phase, setPhase] = useState<Phase>('config')
  const [level, setLevel] = useState<CompressLevel>('medium')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [finishing, setFinishing] = useState(false)

  // Compression can't be aborted mid-run, but if the user closes the panel its
  // eventual result must not surprise-open a PreviewModal. Same guard OcrPanel
  // uses.
  const cancelledRef = useRef(false)

  function handleClose() {
    cancelledRef.current = true
    onClose()
  }

  async function handleStart() {
    setPhase('running')
    try {
      const assembled = await buildPdf(sources, pages, { docAnnotations, assets })
      const result = await compressPdf(assembled, level, setProgress)
      if (cancelledRef.current) return
      setFinishing(true)

      // Is the current plan exactly the uploaded file, untouched? Only then is
      // the original upload a faithful stand-in for the user's document, so we
      // may fall back to it. Any delete/rotate/reorder/merge — or a watermark
      // / page numbers — makes it not pristine (re-assembly is the baseline).
      const pristine =
        docAnnotations.length === 0 &&
        sources.length === 1 &&
        pages.length === sources[0].pageCount &&
        pages.every(
          (p, i) => p.sourceId === sources[0].id && p.sourceIndex === i && p.rotation === 0,
        )

      // The document as it stands WITHOUT our compression — i.e. what the user
      // would otherwise download. For an untouched upload that's the original
      // file itself; pdf-lib re-assembly can duplicate shared resources (a font
      // or image reused across pages) and actually inflate the file.
      const baseline = pristine ? sources[0].bytes : assembled

      // Quality loss is now a deliberate trade; a size increase never is. So
      // the floor holds: never ship a result larger than that input.
      let best = baseline
      if (assembled.length < best.length) best = assembled
      if (result.bytes.length < best.length) best = result.bytes

      const usedOurs = best === result.bytes
      const saved = baseline.length - best.length
      const pct = baseline.length > 0 ? Math.round((saved / baseline.length) * 100) : 0
      const levelLabel = t(`levels.${level}.label`)

      const detail = !result.imagesSupported
        ? t('detailUnsupported')
        : !usedOurs || result.replaced === 0
          ? t('detailEfficient')
          : t('detailRecompressed', { count: result.replaced, level: levelLabel })

      const info = (
        <div className="rounded-xl bg-surface-soft p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">{t('before')}</span>
            <span className="font-bold text-ink">{formatBytes(baseline.length)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-ink-soft">{t('after')}</span>
            <span className="font-bold text-brand-600">{formatBytes(best.length)}</span>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-faint">
            <CompressIcon width={14} height={14} className="mt-0.5 flex-none" />
            {saved > 0 ? `${t('reducedBy', { pct })} ${detail}` : t('alreadyOptimised')}
          </p>
        </div>
      )

      onDone(best, `${baseName}_compressed.pdf`, info)
    } catch {
      if (cancelledRef.current) return
      // Logic-layer errors stay English as diagnostics; show a translated one.
      onError(t('failed'))
    }
  }

  return (
    <Modal
      title={t('title')}
      onClose={handleClose}
      footer={
        phase === 'config' ? (
          <>
            <button type="button" className="btn-secondary" onClick={handleClose}>
              {t('common:cancel')}
            </button>
            <button type="button" className="btn-primary" onClick={handleStart}>
              <CompressIcon width={18} height={18} />
              {t('button')}
            </button>
          </>
        ) : (
          <button type="button" className="btn-secondary" onClick={handleClose}>
            {t('common:cancel')}
          </button>
        )
      }
    >
      {phase === 'config' ? (
        <>
          <p className="text-sm text-ink-soft">{t('intro')}</p>

          <p className="mt-4 text-sm font-bold text-ink">{t('howMuch')}</p>
          <div className="mt-2 space-y-2">
            {LEVELS.map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                  level === option
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-brand-100 bg-white hover:border-brand-200'
                }`}
              >
                <input
                  type="radio"
                  name="compress-level"
                  checked={level === option}
                  onChange={() => setLevel(option)}
                  className="h-4 w-4 accent-brand-500"
                />
                <span className="text-sm font-semibold text-ink">
                  {t(`levels.${option}.label`)}
                </span>
                <span className="text-xs text-ink-faint">{t(`levels.${option}.blurb`)}</span>
              </label>
            ))}
          </div>

          <p className="mt-3 text-xs text-ink-faint">{t('footnote')}</p>

          <p className="mt-4 flex items-start gap-1.5 text-xs text-ink-faint">
            <ShieldIcon width={14} height={14} className="mt-0.5 flex-none text-brand-400" />
            {t('common:privacyFull')}
          </p>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-6">
          <ProgressBar
            value={progress?.done ?? 0}
            max={progress?.total || 1}
            className="max-w-sm"
          />
          <p className="text-sm font-semibold text-ink-soft">
            {finishing
              ? t('finishing')
              : progress && progress.total > 0
                ? t('progress', {
                    current: Math.min(progress.done + 1, progress.total),
                    total: progress.total,
                  })
                : t('scanning')}
          </p>
        </div>
      )}
    </Modal>
  )
}
