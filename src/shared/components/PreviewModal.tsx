import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'
import { savePdf } from '../lib/download'
import { DownloadIcon, ExpandIcon, CollapseIcon } from './icons'

interface PreviewModalProps {
  title: string
  bytes: Uint8Array
  fileName: string
  info?: ReactNode
  /** Covers the preview frame itself with a dimmed/blurred layer — for
   * results the iframe can't meaningfully render (e.g. Protect PDF's output,
   * which the browser can only show as its own native password prompt).
   * Optional and unused by every other tool; the frame renders normally
   * when omitted. */
  overlay?: ReactNode
  /** Custom download action, used instead of saving `bytes` as a PDF — for
   * results that aren't a single PDF (e.g. a multi-file .zip, where `bytes` is
   * just the first file, shown so there's still something to preview). */
  onDownload?: () => void
  /** Download button label; defaults to "Download". */
  downloadLabel?: string
  onClose: () => void
}

export function PreviewModal({
  title,
  bytes,
  fileName,
  info,
  overlay,
  onDownload,
  downloadLabel,
  onClose,
}: PreviewModalProps) {
  const { t } = useTranslation('common')
  const [fullscreen, setFullscreen] = useState(false)

  // A temporary in-memory URL just for showing the PDF in the preview frame.
  const url = useMemo(() => {
    const copy = bytes.slice()
    return URL.createObjectURL(new Blob([copy], { type: 'application/pdf' }))
  }, [bytes])

  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      fullscreen={fullscreen}
      headerAction={
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          aria-label={fullscreen ? t('exitFullscreen') : t('expandFullscreen')}
          title={fullscreen ? t('exitFullscreen') : t('fullscreen')}
          className="icon-btn rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
        >
          {fullscreen ? (
            <CollapseIcon width={20} height={20} />
          ) : (
            <ExpandIcon width={20} height={20} />
          )}
        </button>
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('backToEditing')}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => (onDownload ? onDownload() : void savePdf(bytes, fileName))}
          >
            <DownloadIcon width={18} height={18} />
            {downloadLabel ?? t('download')}
          </button>
        </>
      }
    >
      {info && <div className="mb-3">{info}</div>}
      <p className="mb-2 text-sm text-ink-soft">{t('previewIntro')}</p>
      <div className="relative overflow-hidden rounded-xl border border-black/10 bg-surface-soft">
        <iframe
          title={t('pdfPreview')}
          src={url}
          className={`w-full ${fullscreen ? 'h-[calc(100vh-12rem)]' : 'h-[66vh]'}`}
        />
        {overlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            {overlay}
          </div>
        )}
      </div>
    </Modal>
  )
}
