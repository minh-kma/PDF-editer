import type { ComponentType, SVGProps } from 'react'
import {
  PlusIcon,
  ScissorsIcon,
  ExpandIcon,
  TrashIcon,
  DragIcon,
  CompressIcon,
} from './icons'

// The intent a tool entry carries into the upload flow. Once a file is loaded,
// App maps the intent to the matching panel/action (see App.tsx).
export type ToolIntent = 'merge' | 'split' | 'extract' | 'remove' | 'rearrange' | 'compress'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

interface ToolEntry {
  intent: ToolIntent
  label: string
  description: string
  icon: IconType
}

interface ToolCategory {
  /** Heading text — matches the roadmap category names in features.md. */
  heading: string
  tools: ToolEntry[]
}

// Config-driven catalog. Group headings follow the product roadmap
// (features.md), NOT the code folder layout. Adding a tool when a new feature
// ships is a one-line addition here — no markup to write per tool.
export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    heading: 'Organize PDF',
    tools: [
      { intent: 'merge', label: 'Merge', description: 'Combine several PDFs into one', icon: PlusIcon },
      { intent: 'split', label: 'Split', description: 'Divide a PDF into separate files', icon: ScissorsIcon },
      { intent: 'extract', label: 'Extract pages', description: 'Save chosen pages as a new file', icon: ExpandIcon },
      { intent: 'remove', label: 'Remove pages', description: 'Delete pages you don’t need', icon: TrashIcon },
      { intent: 'rearrange', label: 'Rearrange', description: 'Drag pages into a new order', icon: DragIcon },
    ],
  },
  {
    heading: 'Optimize PDF',
    tools: [
      { intent: 'compress', label: 'Compress', description: 'Shrink the file size, losslessly', icon: CompressIcon },
    ],
  },
]

interface ToolGridProps {
  onSelect: (intent: ToolIntent) => void
  disabled?: boolean
}

/**
 * Landing-page tool discovery. Presentational: it renders the catalog and
 * reports which tool the user picked; App decides how to route that intent
 * into the upload flow.
 */
export function ToolGrid({ onSelect, disabled }: ToolGridProps) {
  return (
    <div className="mt-10">
      <p className="text-center text-sm text-ink-soft">
        Or pick a tool to get started — we’ll ask for your file next.
      </p>

      {TOOL_CATEGORIES.map((category) => (
        <section key={category.heading} className="mt-6">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-ink-faint">
            {category.heading}
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {category.tools.map((tool) => (
              <button
                key={tool.intent}
                type="button"
                onClick={() => onSelect(tool.intent)}
                disabled={disabled}
                className="flex items-start gap-3 rounded-xl border border-brand-100 bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand-100 text-brand-500">
                  <tool.icon width={18} height={18} />
                </span>
                <span>
                  <span className="block text-sm font-bold text-ink">{tool.label}</span>
                  <span className="block text-xs text-ink-faint">{tool.description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
