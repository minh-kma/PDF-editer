// The single place the URL shape is defined. Both the client-side router
// (useRoute.ts) and i18n's path-based language detector (shared/i18n/index.ts)
// parse the location through here — they used to disagree the moment a second
// kind of path existed, and a language detector that misreads the path is
// exactly the D26 bug class.
//
// Deliberately dependency-free (the only import is a type, erased at compile
// time): i18n imports this at module-init from main.tsx, so it must not pull
// React or component code into that path.
import type { ToolIntent } from './toolCatalog'

/** The four tools that have their own URL so far. Every other tool is still
 *  reached only through the mega-menu and leaves the URL alone — adding one
 *  here also means adding its two static HTML entries and its sitemap rows. */
export const ROUTED_TOOLS = {
  'merge-pdf': 'merge',
  'split-pdf': 'split',
  'compress-pdf': 'compress',
  'images-to-pdf': 'imagesToPdf',
} as const satisfies Record<string, ToolIntent>

export type ToolSlug = keyof typeof ROUTED_TOOLS
export type RoutedTool = (typeof ROUTED_TOOLS)[ToolSlug]

const SLUG_FOR_TOOL = Object.fromEntries(
  Object.entries(ROUTED_TOOLS).map(([slug, tool]) => [tool, slug]),
) as Record<RoutedTool, ToolSlug>

export interface ParsedLocation {
  /** Everything before the /vi/ and tool segments — '/' on a root deploy,
   *  '/some/folder/' under a subfolder one (base: './'). Always ends in '/'. */
  basePath: string
  /** True on the Vietnamese pages (/vi/ and /vi/<tool>/). Only ever claims
   *  Vietnamese: English is the absence of the segment, never a segment of its
   *  own, which is what lets the language detector stay silent on the root
   *  path and fall through to localStorage -> navigator (D25/D26). */
  vietnamese: boolean
  /** The tool this URL represents, or null for the homepage. */
  tool: RoutedTool | null
}

/** Splits a pathname into deploy root + language + tool. Segments are popped
 *  from the end (tool, then 'vi'), so whatever is left is the folder the app is
 *  hosted from and a subfolder deploy keeps working. */
export function parseLocation(pathname: string): ParsedLocation {
  const segments = pathname.replace(/index\.html$/, '').split('/').filter(Boolean)

  let tool: RoutedTool | null = null
  const last = segments[segments.length - 1]
  if (last && last in ROUTED_TOOLS) {
    tool = ROUTED_TOOLS[last as ToolSlug]
    segments.pop()
  }

  let vietnamese = false
  if (segments[segments.length - 1] === 'vi') {
    vietnamese = true
    segments.pop()
  }

  const basePath = segments.length ? `/${segments.join('/')}/` : '/'
  return { basePath, vietnamese, tool }
}

/** The inverse of parseLocation. Always ends in a trailing slash: the built
 *  pages reference their assets relatively (base: './'), and those only resolve
 *  correctly when a tool URL is treated as a directory. */
export function buildPath({ basePath, vietnamese, tool }: ParsedLocation): string {
  let path = basePath.endsWith('/') ? basePath : `${basePath}/`
  if (vietnamese) path += 'vi/'
  if (tool) path += `${SLUG_FOR_TOOL[tool]}/`
  return path
}

/** Narrows any ToolIntent to one that has a URL, or null. */
export function routedTool(intent: ToolIntent): RoutedTool | null {
  return intent in SLUG_FOR_TOOL ? (intent as RoutedTool) : null
}
