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
  ImageIcon,
} from '../components/icons'

// The intent a tool entry carries into the upload flow (or, once a file is
// already loaded, straight into the matching mode) — see App.tsx. 'manage'
// is the combined Rotate+Remove+Rearrange tool (formerly two separate
// intents, 'remove' and 'rearrange' — both already routed to the same
// underlying Workspace grid, so they're one tool now, not two). 'unlock' is
// a one-shot action with no mode of its own — it always operates on a
// freshly-picked file, never the current session, so it bypasses mainMode
// entirely; see App.tsx's handleToolSelect.
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
  | 'imagesToPdf'

type IconType = ComponentType<SVGProps<SVGSVGElement>>

// This is a module-level const, so it can't call useTranslation() — it carries
// i18n KEYS and the consumers (MegaMenu, AppBar) resolve them with t() at
// render time. Keys live in the `appbar` namespace.
export interface ToolEntry {
  intent: ToolIntent
  labelKey: `tools.${ToolIntent}.label`
  descriptionKey: `tools.${ToolIntent}.description`
  icon: IconType
}

export interface ToolCategory {
  /** Heading key — matches the roadmap category names in features.md. */
  headingKey: `categories.${'organize' | 'optimize' | 'edit' | 'security' | 'convert'}`
  tools: ToolEntry[]
}

/** Every tool entry's keys follow the same shape, so build them once. */
function tool(intent: ToolIntent, icon: IconType): ToolEntry {
  return {
    intent,
    labelKey: `tools.${intent}.label`,
    descriptionKey: `tools.${intent}.description`,
    icon,
  }
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    headingKey: 'categories.organize',
    tools: [
      tool('merge', PlusIcon),
      tool('split', ScissorsIcon),
      tool('extract', ExpandIcon),
      tool('manage', DragIcon),
    ],
  },
  {
    headingKey: 'categories.optimize',
    tools: [tool('compress', CompressIcon), tool('ocr', ScanIcon)],
  },
  {
    headingKey: 'categories.edit',
    tools: [tool('watermark', WatermarkIcon), tool('pageNumbers', HashIcon)],
  },
  {
    headingKey: 'categories.security',
    tools: [tool('unlock', UnlockIcon), tool('protect', LockIcon)],
  },
  {
    headingKey: 'categories.convert',
    tools: [tool('imagesToPdf', ImageIcon)],
  },
]
