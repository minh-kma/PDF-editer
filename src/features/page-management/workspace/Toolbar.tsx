import { DropZone } from '../../../shared/components/DropZone'
import {
  RotateIcon,
  RefreshIcon,
  ScissorsIcon,
  ExpandIcon,
  CompressIcon,
  DownloadIcon,
} from '../../../shared/components/icons'

interface ToolbarProps {
  onAddFiles: (files: File[]) => void
  onRotateAll: () => void
  onReset: () => void
  onSplit: () => void
  onExtract: () => void
  onCompress: () => void
  onDownload: () => void
  disabled?: boolean
}

export function Toolbar({
  onAddFiles,
  onRotateAll,
  onReset,
  onSplit,
  onExtract,
  onCompress,
  onDownload,
  disabled,
}: ToolbarProps) {
  return (
    <div className="card sticky top-3 z-20 flex flex-wrap items-center gap-2 p-3">
      <DropZone onFiles={onAddFiles} variant="compact" disabled={disabled} />

      <button type="button" className="btn-secondary" onClick={onRotateAll} disabled={disabled}>
        <RotateIcon width={18} height={18} />
        Rotate all
      </button>

      <button type="button" className="btn-secondary" onClick={onSplit} disabled={disabled}>
        <ScissorsIcon width={18} height={18} />
        Split
      </button>

      <button type="button" className="btn-secondary" onClick={onExtract} disabled={disabled}>
        <ExpandIcon width={18} height={18} />
        Extract
      </button>

      <button type="button" className="btn-secondary" onClick={onCompress} disabled={disabled}>
        <CompressIcon width={18} height={18} />
        Compress
      </button>

      <button type="button" className="btn-ghost" onClick={onReset} disabled={disabled}>
        <RefreshIcon width={18} height={18} />
        Start over
      </button>

      <div className="ml-auto">
        <button type="button" className="btn-primary" onClick={onDownload} disabled={disabled}>
          <DownloadIcon width={18} height={18} />
          Download PDF
        </button>
      </div>
    </div>
  )
}
