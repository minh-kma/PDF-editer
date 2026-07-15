import { useEffect, useMemo, type ReactNode } from 'react'
import { Modal } from './Modal'
import { downloadPdf } from '../lib/download'
import { DownloadIcon } from './icons'

interface PreviewModalProps {
  title: string
  bytes: Uint8Array
  fileName: string
  info?: ReactNode
  onClose: () => void
}

export function PreviewModal({ title, bytes, fileName, info, onClose }: PreviewModalProps) {
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
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Back to editing
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => downloadPdf(bytes, fileName)}
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
        <iframe title="PDF preview" src={url} className="h-[60vh] w-full" />
      </div>
    </Modal>
  )
}
