// Config-driven tool catalog, shared by the landing-page ToolGrid and the
// persistent bar's MegaMenu (see shared/components/ToolGrid.tsx and
// shared/components/MegaMenu.tsx). Group headings follow the product
// roadmap (features.md), NOT the code folder layout.
import type { ComponentType, SVGProps } from 'react'
import { PlusIcon, ScissorsIcon, ExpandIcon, DragIcon, CompressIcon } from '../components/icons'

// The intent a tool entry carries into the upload flow (or, once a file is
// already loaded, straight into the matching mode) — see App.tsx. 'manage'
// is the combined Rotate+Remove+Rearrange tool (formerly two separate
// intents, 'remove' and 'rearrange' — both already routed to the same
// underlying Workspace grid, so they're one tool now, not two).
export type ToolIntent = 'merge' | 'split' | 'extract' | 'manage' | 'compress'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

export interface ToolEntry {
  intent: ToolIntent
  label: string
  description: string
  icon: IconType
}

export interface ToolCategory {
  /** Heading text — matches the roadmap category names in features.md. */
  heading: string
  tools: ToolEntry[]
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    heading: 'Organize PDF',
    tools: [
      { intent: 'merge', label: 'Merge', description: 'Combine several PDFs into one', icon: PlusIcon },
      { intent: 'split', label: 'Split', description: 'Divide a PDF into separate files', icon: ScissorsIcon },
      { intent: 'extract', label: 'Extract pages', description: 'Save chosen pages as a new file', icon: ExpandIcon },
      { intent: 'manage', label: 'Manage pages', description: 'Rotate, delete and reorder pages', icon: DragIcon },
    ],
  },
  {
    heading: 'Optimize PDF',
    tools: [
      { intent: 'compress', label: 'Compress', description: 'Shrink the file size, losslessly', icon: CompressIcon },
    ],
  },
]
