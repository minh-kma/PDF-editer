import { useTranslation } from 'react-i18next'
import { DropZone } from './DropZone'
import { MegaMenu } from './MegaMenu'
import { LanguageSwitcher } from './LanguageSwitcher'
import { TOOL_CATEGORIES, type ToolEntry, type ToolIntent } from '../lib/toolCatalog'
// The brand mark is the complete artwork from reference_photos/pdfchill-logo.png,
// scaled down and nothing else (D24), imported so Vite hashes and copies it. The
// favicons in public/ are the same full image at smaller sizes.
import logoMark from '../assets/logo-mark.png'
import {
  ShieldIcon,
  DownloadIcon,
  UndoIcon,
  RedoIcon,
  RefreshIcon,
} from './icons'

interface AppBarProps {
  /** Whether a file is currently loaded (gates Add files / Start over). */
  hasFile: boolean
  busy?: boolean
  onSelectTool: (intent: ToolIntent) => void
  onAddFiles: (files: File[]) => void
  onReset: () => void
  /** Logo click: same destination as Start over, but the caller decides
   * whether to confirm first (there's something to lose) or reset right
   * away (nothing loaded yet). */
  onLogoClick: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onDownload: () => void
}

// Shown inline in the bar rather than tucked behind "All tools" — today's
// most-used, fully-built actions. Pulled from the catalog rather than
// re-declared, so each shortcut's icon and label key stay defined in one place.
const SHORTCUT_INTENTS: ToolIntent[] = ['manage', 'split', 'compress']
const ALL_TOOLS = TOOL_CATEGORIES.flatMap((category) => category.tools)
const SHORTCUTS = SHORTCUT_INTENTS.map(
  (intent) => ALL_TOOLS.find((entry) => entry.intent === intent)!,
) satisfies ToolEntry[]

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
  onLogoClick,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDownload,
}: AppBarProps) {
  // Array form: 'appbar' stays the default namespace, and 'common' is
  // addressable as 'common:…' for strings shared with other screens.
  const { t } = useTranslation(['appbar', 'common'])
  const disabled = !!busy

  return (
    <header className="sticky top-0 z-30 w-full border-b border-black/5 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        {/* Branding — also a reset-to-upload-screen shortcut (App.tsx decides
            whether that needs confirming first). */}
        <button
          type="button"
          onClick={onLogoClick}
          disabled={disabled}
          aria-label={t('logoAria')}
          className="icon-btn flex items-center gap-2.5 rounded-xl hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <img
            src={logoMark}
            alt=""
            width={36}
            height={36}
            className="flex-none rounded-lg"
          />
          <span className="hidden text-xl font-extrabold tracking-tight text-ink sm:inline">
            PDF<span className="text-brand-500">Chill</span>
          </span>
        </button>

        {/* Inline shortcuts */}
        <div className="ml-1 hidden items-center gap-1.5 lg:flex">
          {SHORTCUTS.map((tool) => (
            <button
              key={tool.intent}
              type="button"
              className="appbar-item"
              disabled={disabled}
              onClick={() => onSelectTool(tool.intent)}
            >
              <tool.icon width={18} height={18} />
              {t(tool.labelKey)}
            </button>
          ))}
        </div>

        <MegaMenu onSelect={onSelectTool} disabled={disabled} />

        {hasFile && (
          <>
            <DropZone onFiles={onAddFiles} variant="compact" disabled={disabled} />
            <button type="button" className="btn-ghost" onClick={onReset} disabled={disabled}>
              <RefreshIcon width={18} height={18} />
              {t('startOver')}
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* Always rendered (unlike Undo/Redo/Download, which need a file), so
              the switcher is reachable from the landing screen too. */}
          <LanguageSwitcher disabled={disabled} />

          <div className="hidden items-center gap-2 rounded-full bg-brand-100 px-3 py-1.5 text-sm font-semibold text-brand-700 shadow-soft sm:flex">
            <ShieldIcon width={16} height={16} className="text-brand-600" />
            {t('inBrowser')}
          </div>

          {hasFile && (
            <>
              <button
                type="button"
                onClick={onUndo}
                disabled={disabled || !canUndo}
                title={t('undo')}
                aria-label={t('undo')}
                className="icon-btn rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <UndoIcon width={18} height={18} />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={disabled || !canRedo}
                title={t('redo')}
                aria-label={t('redo')}
                className="icon-btn rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
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
                {t('common:download')}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
