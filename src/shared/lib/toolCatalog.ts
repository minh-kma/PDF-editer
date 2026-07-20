// Config-driven tool catalog, used by the persistent bar's MegaMenu (see
// shared/components/MegaMenu.tsx). Group headings follow the product
// roadmap (features.md), NOT the code folder layout.
import type { ComponentType, SVGProps } from 'react'
import {
  PlusIcon,
  ScissorsIcon,
  ExpandIcon,
  DragIcon,
  CompressIcon,
  ScanIcon,
  UnlockIcon,
  LockIcon,
  WatermarkIcon,
  HashIcon,
} from '../components/icons'

// The intent a tool entry carries into the upload flow (or, once a file is
// already loaded, straight into the matching mode) — see App.tsx. 'manage'
// is the combined Rotate+Remove+Rearrange tool (formerly two separate
// intents, 'remove' and 'rearrange' — both already routed to the same
// underlying Workspace grid, so they're one tool now, not two). 'unlock' is
// a one-shot action with no mode of its own (like 'compress') — it always
// operates on a freshly-picked file, never the current session, so it
// bypasses mainMode entirely; see App.tsx's handleToolSelect.
export type ToolIntent =
  | 'merge'
  | 'split'
  | 'extract'
  | 'manage'
  | 'compress'
  | 'ocr'
  | 'unlock'
  | 'protect'
  | 'watermark'
  | 'pageNumbers'

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
      { intent: 'ocr', label: 'OCR', description: 'Make scanned pages searchable', icon: ScanIcon },
    ],
  },
  {
    heading: 'Edit PDF',
    tools: [
      { intent: 'watermark', label: 'Watermark', description: 'Stamp text or a logo across pages', icon: WatermarkIcon },
      { intent: 'pageNumbers', label: 'Page numbers', description: 'Number the pages of your PDF', icon: HashIcon },
    ],
  },
  {
    heading: 'Security',
    tools: [
      { intent: 'unlock', label: 'Unlock', description: "Remove a PDF's password", icon: UnlockIcon },
      { intent: 'protect', label: 'Protect', description: 'Add a password to a PDF', icon: LockIcon },
    ],
  },
]
