// Config-driven tool catalog, shared by the landing-page ToolGrid and the
// persistent bar's MegaMenu (see shared/components/ToolGrid.tsx and
// shared/components/MegaMenu.tsx). Group headings follow the product
// roadmap (features.md), NOT the code folder layout.
import type { ComponentType, SVGProps } from 'react'
import {
  PlusIcon,
  ScissorsIcon,
  ExpandIcon,
  TrashIcon,
  DragIcon,
  CompressIcon,
} from '../components/icons'

// The intent a tool entry carries into the upload flow (or, once a file is
// already loaded, straight into the matching mode) — see App.tsx.
export type ToolIntent = 'merge' | 'split' | 'extract' | 'remove' | 'rearrange' | 'compress'

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
