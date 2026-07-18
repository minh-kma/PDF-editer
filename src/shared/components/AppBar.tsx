import type { ComponentType, SVGProps } from 'react'
import { DropZone } from './DropZone'
import { MegaMenu } from './MegaMenu'
import type { ToolIntent } from '../lib/toolCatalog'
import {
  ShieldIcon,
  DownloadIcon,
  UndoIcon,
  RedoIcon,
  RefreshIcon,
  DragIcon,
  ScissorsIcon,
  CompressIcon,
} from './icons'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

interface AppBarProps {
  /** Whether a file is currently loaded (gates Add files / Start over). */
  hasFile: boolean
  busy?: boolean
  onSelectTool: (intent: ToolIntent) => void
  onAddFiles: (files: File[]) => void
  onReset: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onDownload: () => void
}

// Shown inline in the bar rather than tucked behind "All tools" — today's
// most-used, fully-built actions.
const SHORTCUTS: { intent: ToolIntent; label: string; icon: IconType }[] = [
  { intent: 'manage', label: 'Manage pages', icon: DragIcon },
  { intent: 'split', label: 'Split', icon: ScissorsIcon },
  { intent: 'compress', label: 'Compress', icon: CompressIcon },
]

/**
 * Persistent top bar: branding, a few inline tool shortcuts, the "All tools"
 * mega-menu, and Undo/Redo/Download. The tool shortcuts/mega-menu always
 * render (busy-disabled only) since they're how a tool is picked before any
 * file exists; Add files/Start over/Undo/Redo/Download only make sense once
 * a file is loaded, so they render conditionally instead of just disabled.
 */
export function AppBar({
  hasFile,
  busy,
  onSelectTool,
  onAddFiles,
  onReset,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDownload,
}: AppBarProps) {
  const disabled = !!busy

  return (
    <header className="sticky top-0 z-30 w-full border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        {/* Branding */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-brand-500 font-extrabold text-white shadow-soft">
            P
          </div>
          <span className="hidden text-xl font-extrabold tracking-tight text-ink sm:inline">
            PDF<span className="text-brand-500">demo</span>
          </span>
        </div>

        {/* Inline shortcuts */}
        <div className="ml-1 hidden items-center gap-1.5 lg:flex">
          {SHORTCUTS.map((tool) => (
            <button
              key={tool.intent}
              type="button"
              className="btn-secondary"
              disabled={disabled}
              onClick={() => onSelectTool(tool.intent)}
            >
              <tool.icon width={18} height={18} />
              {tool.label}
            </button>
          ))}
        </div>

        <MegaMenu onSelect={onSelectTool} disabled={disabled} />

        {hasFile && (
          <>
            <DropZone onFiles={onAddFiles} variant="compact" disabled={disabled} />
            <button type="button" className="btn-ghost" onClick={onReset} disabled={disabled}>
              <RefreshIcon width={18} height={18} />
              Start over
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <div className="hidden items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-ink-soft shadow-soft sm:flex">
            <ShieldIcon width={16} height={16} className="text-brand-400" />
            100% in your browser
          </div>

          {hasFile && (
            <>
              <button
                type="button"
                onClick={onUndo}
                disabled={disabled || !canUndo}
                title="Undo"
                aria-label="Undo"
                className="btn-motion rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <UndoIcon width={18} height={18} />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={disabled || !canRedo}
                title="Redo"
                aria-label="Redo"
                className="btn-motion rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RedoIcon width={18} height={18} />
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onDownload}
                disabled={disabled}
              >
                <DownloadIcon width={18} height={18} />
                Download
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
