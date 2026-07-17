import type { ComponentType, SVGProps } from 'react'
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

type IconType = ComponentType<SVGProps<SVGSVGElement>>

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-6 w-px flex-none self-center bg-brand-100" />
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
  // Editing actions clustered by roadmap category (features.md), so Edit and
  // Security tools have an obvious home when they ship — add an entry (or a new
  // group) here, no layout rewrite. Rotate lives under "Edit" per features.md,
  // even though its code sits in workspace/ (decision D2).
  const editingGroups: { tools: { label: string; icon: IconType; onClick: () => void }[] }[] = [
    // Organize
    {
      tools: [
        { label: 'Split', icon: ScissorsIcon, onClick: onSplit },
        { label: 'Extract', icon: ExpandIcon, onClick: onExtract },
      ],
    },
    // Optimize
    {
      tools: [{ label: 'Compress', icon: CompressIcon, onClick: onCompress }],
    },
    // Edit
    {
      tools: [{ label: 'Rotate all', icon: RotateIcon, onClick: onRotateAll }],
    },
  ]

  return (
    <div className="card sticky top-3 z-20 flex flex-wrap items-center gap-2 p-3">
      {/* File management */}
      <DropZone onFiles={onAddFiles} variant="compact" disabled={disabled} />
      <button type="button" className="btn-ghost" onClick={onReset} disabled={disabled}>
        <RefreshIcon width={18} height={18} />
        Start over
      </button>

      <Divider />

      {/* Editing tools, grouped by roadmap category */}
      {editingGroups.map((group, gi) => (
        <div key={gi} className="flex flex-wrap items-center gap-2">
          {gi > 0 && <Divider />}
          {group.tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              className="btn-secondary"
              onClick={tool.onClick}
              disabled={disabled}
            >
              <tool.icon width={18} height={18} />
              {tool.label}
            </button>
          ))}
        </div>
      ))}

      {/* Primary action */}
      <div className="ml-auto">
        <button type="button" className="btn-primary" onClick={onDownload} disabled={disabled}>
          <DownloadIcon width={18} height={18} />
          Download PDF
        </button>
      </div>
    </div>
  )
}
