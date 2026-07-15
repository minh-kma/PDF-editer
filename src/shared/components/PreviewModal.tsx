import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { savePdf } from '../lib/download'
import { DownloadIcon, ExpandIcon, CollapseIcon } from './icons'

interface PreviewModalProps {
  title: string
  bytes: Uint8Array
  fileName: string
  info?: ReactNode
  onClose: () => void
}

export function PreviewModal({ title, bytes, fileName, info, onClose }: PreviewModalProps) {
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
          aria-label={fullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          className="btn-motion rounded-lg p-1.5 text-ink-soft hover:bg-brand-50 hover:text-brand-600"
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
            Back to editing
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void savePdf(bytes, fileName)}
          >
            <DownloadIcon width={18} height={18} />
            Download
          </button>
        </>
      }
    >
      {info && <div className="mb-3">{info}</div>}
      <p className="mb-2 text-sm text-ink-soft">
        Here's your result. Check it looks right, then download it.
      </p>
      <div className="overflow-hidden rounded-xl border border-black/10 bg-cream-soft">
        <iframe
          title="PDF preview"
          src={url}
          className={`w-full ${fullscreen ? 'h-[calc(100vh-12rem)]' : 'h-[66vh]'}`}
        />
      </div>
    </Modal>
  )
}
