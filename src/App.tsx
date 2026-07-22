import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppBar } from './shared/components/AppBar'
import { DropZone } from './shared/components/DropZone'
import { Workspace } from './features/page-management/workspace/Workspace'
import { BrowseView } from './features/page-management/workspace/BrowseView'
import { SplitPanel } from './features/page-management/split/SplitPanel'
import { ExtractPanel } from './features/page-management/split/ExtractPanel'
import { ProtectPanel } from './features/security/protect/ProtectPanel'
import { OcrPanel } from './features/optimize/ocr/OcrPanel'
import { CompressPanel } from './features/page-management/compress/CompressPanel'
import { WatermarkPanel } from './features/edit/doc-marks/WatermarkPanel'
import { PageNumbersPanel } from './features/edit/doc-marks/PageNumbersPanel'
import { ImagesToPdfView } from './features/convert/images-to-pdf/ImagesToPdfView'
import { PreviewModal } from './shared/components/PreviewModal'
import { RecoverBanner } from './shared/components/RecoverBanner'
import { BusyOverlay } from './shared/components/BusyOverlay'
import { Toast } from './shared/components/Toast'
import { PasswordPrompt } from './shared/components/PasswordPrompt'
import { ConfirmDialog } from './shared/components/ConfirmDialog'
import { ShieldIcon, LockIcon } from './shared/components/icons'
import { useStore } from './shared/state/store'
import { probePdf, decryptPdf, WrongPasswordError } from './shared/lib/pdfUnlock'
import { buildPdf } from './features/page-management/workspace/buildPdf'
import { baseName } from './shared/lib/format'
import { saveSession, loadSession, clearSession, type SavedSession } from './shared/lib/storage'
import { useRoute } from './shared/lib/useRoute'
import { routedTool, type RoutedTool } from './shared/lib/routes'
import type { ToolIntent } from './shared/lib/toolCatalog'

interface PreviewState {
  title: string
  bytes: Uint8Array
  fileName: string
  info?: React.ReactNode
  /** Protect PDF only (see PreviewModal's `overlay` prop) — the encrypted
   * result can't render in the preview frame, so this covers it with a
   * confirmation instead of the browser's native password prompt. */
  overlay?: React.ReactNode
  /** Images to PDF's one-PDF-per-image mode only — `bytes` previews the first
   * PDF while the download hands over the whole .zip. */
  onDownload?: () => void
  downloadLabel?: string
}

// Which UI the main content area shows. 'browse' (the default, single-page
// viewer) is what every tool returns to when closed/finished. 'manage' is
// the combined Rotate+Remove+Rearrange grid (Workspace.tsx, unchanged
// internally — just now an explicitly-selected tool instead of the
// default). Unlock is NOT a mode — it's an instant one-shot action that goes
// straight to a PreviewModal. 'protect', 'ocr' and 'compress' need user input
// first (a password; a language pick; a compression level), so — unlike
// Unlock — they're modal-form panels, same pattern as split/extract.
// 'watermark' and 'pageNumbers' are modal-form panels over Browse, same
// pattern as split/extract. 'imagesToPdf' is the odd one out: it starts from
// images rather than a PDF, so it takes over the main content area and needs
// no file loaded at all.
type MainMode =
  | { kind: 'browse' }
  | { kind: 'manage' }
  | { kind: 'split' }
  | { kind: 'extract' }
  | { kind: 'protect' }
  | { kind: 'ocr' }
  | { kind: 'compress' }
  | { kind: 'watermark' }
  | { kind: 'pageNumbers' }
  | { kind: 'imagesToPdf' }

// Don't offer to restore a session that's gone stale — past this age, skip
// the recover banner and proceed as if no session existed.
const RECOVER_MAX_AGE_MS = 5 * 60 * 1000

export default function App() {
  const { t, i18n } = useTranslation(['landing', 'errors', 'appbar', 'seo'])
  const store = useStore()
  const {
    sources,
    pages,
    docAnnotations,
    assets,
    busy,
    busyMessage,
    addSource,
    reset,
    restore,
    setBusy,
    undo,
    redo,
    canUndo,
    canRedo,
  } = store

  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [mainMode, setMainMode] = useState<MainMode>({ kind: 'browse' })
  const [recover, setRecover] = useState<SavedSession | null>(null)

  // A tool the user picked from the landing grid before uploading. Once a file
  // is loaded, the matching panel/action is opened (see the effect below).
  const [pendingTool, setPendingTool] = useState<ToolIntent | null>(null)
  const toolFileInput = useRef<HTMLInputElement>(null)

  // Four tools have their own URL (/merge-pdf/, /split-pdf/, /compress-pdf/,
  // /images-to-pdf/, each also under /vi/). The route is what a search result
  // lands on and what in-app navigation pushes; every other tool leaves the URL
  // alone and works exactly as before.
  const { tool: routeTool, navigateToTool } = useRoute()

  // Unlock (mega-menu tool): always operates on a freshly-picked file, never
  // the current session — its own file input, separate from toolFileInput,
  // so picking a file here never touches addSource/the page-plan store.
  const unlockFileInput = useRef<HTMLInputElement>(null)

  // Password-unlock (D8): prompt state + the current prompt's resolver, plus an
  // in-memory password cached for this session only (never persisted; a reload
  // re-prompts). Cleared on Start over.
  const [pendingUnlock, setPendingUnlock] = useState<{
    fileName: string
    wrongPassword: boolean
  } | null>(null)
  const [unlockBusy, setUnlockBusy] = useState(false)
  const unlockResolver = useRef<((password: string | null) => void) | null>(null)
  const sessionPassword = useRef<string | null>(null)

  const hasPages = pages.length > 0

  // A friendly default name for the exported file.
  const outputName = useCallback(() => {
    if (sources.length === 1) return `${baseName(sources[0].name)}_edited.pdf`
    return 'PDFChill_merged.pdf'
  }, [sources])

  // -- Reload recovery: look for a saved session on first load ---------------
  useEffect(() => {
    loadSession().then((session) => {
      if (session && Date.now() - session.savedAt <= RECOVER_MAX_AGE_MS) setRecover(session)
    })
  }, [])

  // -- Reload recovery: quietly save the session as work changes (debounced) --
  useEffect(() => {
    // Don't save while the recover banner is still offering to restore, or
    // before the user has actually done anything.
    if (recover) return
    const t = setTimeout(() => {
      saveSession(sources, pages, docAnnotations, assets).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [sources, pages, docAnnotations, assets, recover])

  // -- Undo / redo keyboard shortcuts ----------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      // Don't hijack undo inside a text field.
      const el = document.activeElement
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          (el as HTMLElement).isContentEditable)
      ) {
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (k === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // -- Password unlock (D8) --------------------------------------------------
  // Show the prompt and resolve once the user submits a password or skips.
  const requestPassword = useCallback(
    (fileName: string, wrongPassword: boolean) =>
      new Promise<string | null>((resolve) => {
        unlockResolver.current = resolve
        setPendingUnlock({ fileName, wrongPassword })
      }),
    [],
  )

  // Turn protected bytes into plaintext bytes, or null if skipped/unusable.
  const unlockFile = useCallback(
    async (fileName: string, bytes: Uint8Array): Promise<Uint8Array | null> => {
      // Try the session password and an empty password (owner-only / permissions
      // -only files) silently before bothering the user.
      const silent = [sessionPassword.current, ''].filter(
        (pw, i, a): pw is string => pw != null && a.indexOf(pw) === i,
      )
      for (const pw of silent) {
        try {
          return await decryptPdf(bytes, pw)
        } catch (err) {
          if (!(err instanceof WrongPasswordError)) {
            setError(t('errors:couldNotUnlockNamed', { fileName }))
            return null
          }
        }
      }
      // Prompt loop — unlimited retries until the password works or the user skips.
      let wrong = false
      for (;;) {
        const pw = await requestPassword(fileName, wrong)
        if (pw === null) {
          setPendingUnlock(null)
          return null
        }
        setUnlockBusy(true)
        try {
          const out = await decryptPdf(bytes, pw)
          sessionPassword.current = pw // reuse for the rest of this session
          setUnlockBusy(false)
          setPendingUnlock(null)
          return out
        } catch (err) {
          setUnlockBusy(false)
          if (err instanceof WrongPasswordError) {
            wrong = true
            continue
          }
          setPendingUnlock(null)
          setError(t('errors:couldNotUnlockNamed', { fileName }))
          return null
        }
      }
    },
    [requestPassword],
  )

  // -- Unlock (mega-menu tool): pick a file, decrypt it, preview the result —
  // never touches the page-plan store, never lands the user in Browse.
  // A one-shot shape: setBusy while working, end at setPreview (CLAUDE.md:
  // never auto-download, always preview first).
  const handleUnlockTool = useCallback(
    async (file: File) => {
      try {
        setBusy(true, t('errors:busy.reading'))
        const bytes = new Uint8Array(await file.arrayBuffer())
        const probe = await probePdf(bytes)

        if (probe.status === 'damaged') {
          setError(t('errors:couldNotOpen', { fileName: file.name }))
          return
        }
        if (probe.status === 'ok') {
          setError(t('errors:notProtected', { fileName: file.name }))
          return
        }

        setBusy(false) // release the overlay so the password prompt is usable
        const unlocked = await unlockFile(file.name, bytes)
        if (!unlocked) return // skipped or failed — unlockFile already surfaced any error

        setPreview({
          title: t('errors:results.unlocked'),
          bytes: unlocked,
          fileName: `${baseName(file.name)}_unlocked.pdf`,
        })
      } catch (err) {
        // Logic-layer errors stay English as diagnostics; show a translated one.
        setError(t('errors:unlockFailed'))
      } finally {
        setBusy(false)
      }
    },
    [unlockFile, setBusy],
  )

  // -- File upload -----------------------------------------------------------
  const handleFiles = useCallback(
    async (files: File[]) => {
      try {
        for (const file of files) {
          setBusy(true, t('errors:busy.reading'))
          const bytes = new Uint8Array(await file.arrayBuffer())
          const probe = await probePdf(bytes)

          if (probe.status === 'damaged') {
            setError(t('errors:couldNotOpen', { fileName: file.name }))
            continue
          }

          let plaintext: Uint8Array = bytes
          let pageCount = probe.status === 'ok' ? probe.pageCount : 0

          if (probe.status === 'encrypted') {
            setBusy(false) // release the overlay so the prompt is usable
            const unlocked = await unlockFile(file.name, bytes)
            if (!unlocked) continue // skipped or failed
            plaintext = unlocked
            setBusy(true, t('errors:busy.reading'))
            const after = await probePdf(plaintext)
            if (after.status !== 'ok') {
              setError(t('errors:couldNotReadAfterUnlock', { fileName: file.name }))
              continue
            }
            pageCount = after.pageCount
          }

          addSource({ id: crypto.randomUUID(), name: file.name, bytes: plaintext, pageCount })
        }
      } finally {
        setBusy(false)
      }
    },
    [addSource, setBusy, unlockFile],
  )

  // -- Download (build the assembled PDF, then preview) ----------------------
  const handleDownload = useCallback(async () => {
    try {
      setBusy(true, t('errors:busy.preparing'))
      const bytes = await buildPdf(sources, pages, { docAnnotations, assets })
      setPreview({ title: t('errors:results.ready'), bytes, fileName: outputName() })
    } catch (err) {
      // Logic-layer errors stay English as diagnostics; show a translated one.
      setError(t('errors:buildFailed'))
    } finally {
      setBusy(false)
    }
  }, [sources, pages, docAnnotations, assets, outputName, setBusy])

  // -- Tool discovery (persistent bar + landing grid) -------------------------
  // 'unlock' always needs a freshly-picked file (never the current session —
  // uploaded files are already decrypted by the time they're in the store),
  // so it always opens its own dedicated picker. 'merge' always needs a new
  // file to combine, so it always opens the picker too. Everything else, if
  // a file is already loaded, applies straight to the current pages (no
  // re-upload); otherwise it remembers the intent and opens the picker, same
  // as a fresh landing-page pick.
  // The selection itself, shared by the menu and the URL. `openPicker` is the
  // only difference between the two: a click can open the file dialog, a page
  // load cannot (browsers require a user gesture), so a URL arms the tool and
  // leaves the user on the normal upload screen — the pendingTool effect below
  // then opens it as soon as a file arrives, which is the same path a
  // menu-pick-then-upload takes.
  const appliedRoute = useRef<RoutedTool | null | undefined>(undefined)
  // 'unlock' is excluded by type: it has no mode of its own and is routed to its
  // own file picker before it could ever reach here (and it has no URL either).
  const applyTool = useCallback(
    (intent: Exclude<ToolIntent, 'unlock'>, { openPicker }: { openPicker: boolean }) => {
      // Images to PDF brings its own images — it must never demand a PDF
      // upload first, so it opens ahead of the !hasPages check below.
      if (intent === 'imagesToPdf') {
        setMainMode({ kind: 'imagesToPdf' })
        return
      }
      if (intent === 'merge' || !hasPages) {
        setPendingTool(intent)
        if (openPicker) toolFileInput.current?.click()
        return
      }
      setMainMode({ kind: intent })
    },
    [hasPages],
  )

  const handleToolSelect = useCallback(
    (intent: ToolIntent) => {
      if (intent === 'unlock') {
        unlockFileInput.current?.click()
        return
      }
      // Routed tools take the URL with them; the rest leave it where it is.
      const routed = routedTool(intent)
      if (routed) {
        appliedRoute.current = routed // already handled here — don't re-apply
        navigateToTool(routed)
      }
      applyTool(intent, { openPicker: true })
    },
    [applyTool, navigateToTool],
  )

  // The URL as an input: a direct load (search result, shared link, reload) and
  // the browser's back/forward buttons both land here. Guarded by the last route
  // this actually applied, so a tool picked from the menu — which navigates
  // itself — isn't opened a second time.
  useEffect(() => {
    if (appliedRoute.current === routeTool) return
    appliedRoute.current = routeTool
    if (routeTool) applyTool(routeTool, { openPicker: false })
    else {
      // Back to the homepage URL: drop any armed tool and return to the default
      // view, matching what closing a tool does.
      setPendingTool(null)
      setMainMode({ kind: 'browse' })
    }
  }, [routeTool, applyTool])

  // Returns to the default view *and* to the homepage URL. Non-routed panels
  // are already on the homepage URL, where navigateToTool(null) is a no-op.
  const closeTool = useCallback(() => {
    setMainMode({ kind: 'browse' })
    appliedRoute.current = null
    navigateToTool(null)
  }, [navigateToTool])

  // Once pages exist and a tool was requested, open that tool's mode/action.
  // A merge upload lands in 'manage' (not the 'browse' default) so the user
  // immediately sees the combined page order and can fix it.
  useEffect(() => {
    // Wait until reading finishes (busy false) so modes open after the load
    // overlay clears and multi-file uploads don't fire a tool mid-read.
    if (!hasPages || !pendingTool || busy) return
    const intent = pendingTool
    setPendingTool(null)
    if (intent === 'split') setMainMode({ kind: 'split' })
    else if (intent === 'extract') setMainMode({ kind: 'extract' })
    else if (intent === 'protect') setMainMode({ kind: 'protect' })
    else if (intent === 'ocr') setMainMode({ kind: 'ocr' })
    else if (intent === 'watermark') setMainMode({ kind: 'watermark' })
    else if (intent === 'pageNumbers') setMainMode({ kind: 'pageNumbers' })
    else if (intent === 'compress') setMainMode({ kind: 'compress' })
    else if (intent === 'manage' || intent === 'merge') setMainMode({ kind: 'manage' })
    // 'unlock' never reaches here — handleToolSelect routes it to its own
    // file input before pendingTool is ever set.
  }, [hasPages, pendingTool, busy])

  // -- Document title --------------------------------------------------------
  // Each static page ships with its own baked <title> for crawlers; this keeps
  // the tab honest afterwards, when the route changes without a reload or the
  // language resolves to the other one. Same strings as the HTML files (see the
  // note in locales/en/index.ts). i18n.language is in the deps because the
  // detected language can differ from what the page baked in.
  useEffect(() => {
    document.title = t(`seo:${routeTool ?? 'home'}.title`)
  }, [routeTool, t, i18n.language])

  // -- Start over ------------------------------------------------------------
  const handleReset = useCallback(() => {
    reset()
    closeTool() // don't carry a stale mode — or a stale tool URL — into the next upload
    sessionPassword.current = null // forget the cached password on Start over
    clearSession().catch(() => {})
  }, [reset, closeTool])

  // -- Logo click: same destination as Start over, confirm first if there's
  // a session to lose (nothing to confirm when the screen is already empty).
  const [confirmReset, setConfirmReset] = useState(false)
  const handleLogoClick = useCallback(() => {
    if (hasPages) setConfirmReset(true)
    else handleReset()
  }, [hasPages, handleReset])

  // -- Recover banner actions ------------------------------------------------
  const handleRestore = useCallback(() => {
    if (recover) {
      restore(
        recover.sources,
        recover.pages,
        recover.docAnnotations,
        recover.assets,
      )
    }
    setRecover(null)
  }, [recover, restore])

  const handleDismissRecover = useCallback(() => {
    setRecover(null)
    clearSession().catch(() => {})
  }, [])

  return (
    <div className="min-h-screen">
      <AppBar
        // While converting images there's no PDF session in play, so the
        // page-plan actions (Download / Undo / Redo / Add more PDFs / Start
        // over) would act on the wrong thing — hide them for that mode.
        hasFile={hasPages && mainMode.kind !== 'imagesToPdf'}
        busy={busy}
        onSelectTool={handleToolSelect}
        onAddFiles={handleFiles}
        onReset={handleReset}
        onLogoClick={handleLogoClick}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onDownload={handleDownload}
      />

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* Intro headline (only before any pages are loaded). On a tool URL it
            names that tool instead of the site, so a visitor arriving from a
            search result sees the page they clicked. The heading comes from the
            `seo` namespace so it reads like the page title they clicked ("Split
            PDF"), not like the mega-menu entry ("Split"); the subtitle reuses
            the menu's existing tool description. Driven by the URL, not
            pendingTool, so picking a tool and cancelling the file dialog doesn't
            rewrite the headline. */}
        {!hasPages && !recover && mainMode.kind !== 'imagesToPdf' && (
          <div className="mb-6 mt-2 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {routeTool ? t(`seo:${routeTool}.heading`) : t('heroTitle')}
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-ink-soft">
              {routeTool ? t(`appbar:tools.${routeTool}.description`) : t('heroSubtitle')}
            </p>
          </div>
        )}

        {recover && (
          <div className="mb-6 mt-2">
            <RecoverBanner
              savedAt={recover.savedAt}
              onRestore={handleRestore}
              onDismiss={handleDismissRecover}
            />
          </div>
        )}

        {mainMode.kind === 'imagesToPdf' ? (
          <ImagesToPdfView
            onClose={closeTool}
            onError={setError}
            onCreated={setPreview}
          />
        ) : !hasPages ? (
          <>
            <DropZone
              onFiles={(files) => {
                // A plain upload clears any tool the user may have picked and
                // then cancelled, so it doesn't fire unexpectedly on load — but
                // never a tool the URL armed: on /split-pdf/ this drop zone *is*
                // Split's upload step, and clearing it would drop the user into
                // the plain viewer instead.
                if (!routeTool) setPendingTool(null)
                handleFiles(files)
              }}
              disabled={busy}
            />
            <PrivacyNote />
          </>
        ) : (
          <div className="space-y-4">
            {mainMode.kind === 'manage' ? <Workspace /> : <BrowseView />}
            <PrivacyNote />
          </div>
        )}
      </main>

      {mainMode.kind === 'watermark' && (
        <WatermarkPanel onClose={closeTool} />
      )}

      {mainMode.kind === 'pageNumbers' && (
        <PageNumbersPanel onClose={closeTool} />
      )}

      {mainMode.kind === 'split' && (
        <SplitPanel
          baseName={baseName(outputName())}
          onClose={closeTool}
          onError={(m) => {
            closeTool()
            setError(m)
          }}
        />
      )}

      {mainMode.kind === 'extract' && (
        <ExtractPanel
          baseName={baseName(outputName())}
          onClose={closeTool}
          onError={(m) => {
            closeTool()
            setError(m)
          }}
          onExtracted={(bytes, fileName) => {
            closeTool()
            setPreview({ title: t('errors:results.extracted'), bytes, fileName })
          }}
        />
      )}

      {mainMode.kind === 'protect' && (
        <ProtectPanel
          baseName={baseName(outputName())}
          onClose={closeTool}
          onError={(m) => {
            closeTool()
            setError(m)
          }}
          onProtected={(bytes, fileName) => {
            closeTool()
            setPreview({
              title: t('errors:results.protected'),
              bytes,
              fileName,
              // The encrypted result can only render in the preview frame as
              // the browser's own native password prompt — confusing right
              // after the user just chose that password — so cover it with
              // a plain confirmation instead. Download still works normally
              // (the footer button is outside this overlay).
              overlay: (
                <div className="flex flex-col items-center gap-2 px-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-500">
                    <LockIcon width={24} height={24} />
                  </span>
                  <p className="font-bold text-ink">{t('errors:protectedNotice.title')}</p>
                  <p className="text-sm text-ink-soft">
                    {t('errors:protectedNotice.body')}
                  </p>
                </div>
              ),
            })
          }}
        />
      )}

      {mainMode.kind === 'ocr' && (
        <OcrPanel
          baseName={baseName(outputName())}
          onClose={closeTool}
          onError={(m) => {
            closeTool()
            setError(m)
          }}
          onDone={(bytes, fileName) => {
            closeTool()
            setPreview({ title: t('errors:results.searchable'), bytes, fileName })
          }}
        />
      )}

      {mainMode.kind === 'compress' && (
        <CompressPanel
          baseName={baseName(outputName())}
          onClose={closeTool}
          onError={(m) => {
            closeTool()
            setError(m)
          }}
          onDone={(bytes, fileName, info) => {
            closeTool()
            setPreview({ title: t('errors:results.compressed'), bytes, fileName, info })
          }}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title={t('confirmReset.title')}
          message={t('confirmReset.message')}
          confirmLabel={t('confirmReset.confirm')}
          cancelLabel={t('confirmReset.cancel')}
          onConfirm={() => {
            setConfirmReset(false)
            handleReset()
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}

      {pendingUnlock && (
        <PasswordPrompt
          fileName={pendingUnlock.fileName}
          wrongPassword={pendingUnlock.wrongPassword}
          busy={unlockBusy}
          onSubmit={(pw) => unlockResolver.current?.(pw)}
          onCancel={() => unlockResolver.current?.(null)}
        />
      )}

      {preview && (
        <PreviewModal
          title={preview.title}
          bytes={preview.bytes}
          fileName={preview.fileName}
          info={preview.info}
          overlay={preview.overlay}
          onDownload={preview.onDownload}
          downloadLabel={preview.downloadLabel}
          onClose={() => setPreview(null)}
        />
      )}

      {/* Hidden picker used when a tool is launched from the landing grid. */}
      <input
        ref={toolFileInput}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter(
            (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
          )
          e.target.value = '' // allow re-picking the same file
          if (files.length) handleFiles(files)
        }}
      />

      {/* Hidden picker used by the Unlock tool — deliberately separate from
          toolFileInput above: picking a file here never calls addSource, so
          it never touches the page-plan store. */}
      <input
        ref={unlockFileInput}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) handleUnlockTool(file)
        }}
      />

      {busy && <BusyOverlay message={busyMessage} />}
      {error && <Toast message={error} onClose={() => setError(null)} />}
    </div>
  )
}

function PrivacyNote() {
  const { t } = useTranslation('common')
  return (
    <p className="mx-auto mt-5 flex max-w-2xl items-center justify-center gap-2 text-center text-xs text-ink-faint">
      <ShieldIcon width={14} height={14} className="flex-none text-brand-400" />
      {t('privacyNote')}
    </p>
  )
}
