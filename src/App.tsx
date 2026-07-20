import { useCallback, useEffect, useRef, useState } from 'react'
import { AppBar } from './shared/components/AppBar'
import { DropZone } from './shared/components/DropZone'
import { Workspace } from './features/page-management/workspace/Workspace'
import { BrowseView } from './features/page-management/workspace/BrowseView'
import { SplitPanel } from './features/page-management/split/SplitPanel'
import { ExtractPanel } from './features/page-management/split/ExtractPanel'
import { ProtectPanel } from './features/security/protect/ProtectPanel'
import { OcrPanel } from './features/optimize/ocr/OcrPanel'
import { WatermarkPanel } from './features/edit/doc-marks/WatermarkPanel'
import { PageNumbersPanel } from './features/edit/doc-marks/PageNumbersPanel'
import { PreviewModal } from './shared/components/PreviewModal'
import { RecoverBanner } from './shared/components/RecoverBanner'
import { BusyOverlay } from './shared/components/BusyOverlay'
import { Toast } from './shared/components/Toast'
import { PasswordPrompt } from './shared/components/PasswordPrompt'
import { ConfirmDialog } from './shared/components/ConfirmDialog'
import { ShieldIcon, CompressIcon, LockIcon } from './shared/components/icons'
import { useStore } from './shared/state/store'
import { probePdf, decryptPdf, WrongPasswordError } from './shared/lib/pdfUnlock'
import { buildPdf } from './features/page-management/workspace/buildPdf'
import { compressPdf } from './features/page-management/compress/compressPdf'
import { formatBytes, baseName } from './shared/lib/format'
import { saveSession, loadSession, clearSession, type SavedSession } from './shared/lib/storage'
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
}

// Which UI the main content area shows. 'browse' (the default, single-page
// viewer) is what every tool returns to when closed/finished. 'manage' is
// the combined Rotate+Remove+Rearrange grid (Workspace.tsx, unchanged
// internally — just now an explicitly-selected tool instead of the
// default). Compress and Unlock are NOT modes — they're instant one-shot
// actions that go straight to a PreviewModal, same as today. 'protect' and
// 'ocr' need user input first (a password; a language pick), so — unlike
// Compress/Unlock — they're modal-form panels, same pattern as split/extract.
// 'watermark' and 'pageNumbers' are modal-form panels over Browse, same
// pattern as split/extract.
type MainMode =
  | { kind: 'browse' }
  | { kind: 'manage' }
  | { kind: 'split' }
  | { kind: 'extract' }
  | { kind: 'protect' }
  | { kind: 'ocr' }
  | { kind: 'watermark' }
  | { kind: 'pageNumbers' }

// Don't offer to restore a session that's gone stale — past this age, skip
// the recover banner and proceed as if no session existed.
const RECOVER_MAX_AGE_MS = 5 * 60 * 1000

export default function App() {
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
    return 'PDFdemo_merged.pdf'
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
            setError(`"${fileName}" could not be unlocked.`)
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
          setError(`"${fileName}" could not be unlocked.`)
          return null
        }
      }
    },
    [requestPassword],
  )

  // -- Unlock (mega-menu tool): pick a file, decrypt it, preview the result —
  // never touches the page-plan store, never lands the user in Browse.
  // Mirrors handleCompress's one-shot shape: setBusy while working, end at
  // setPreview (CLAUDE.md: never auto-download, always preview first).
  const handleUnlockTool = useCallback(
    async (file: File) => {
      try {
        setBusy(true, 'Reading your file…')
        const bytes = new Uint8Array(await file.arrayBuffer())
        const probe = await probePdf(bytes)

        if (probe.status === 'damaged') {
          setError(`"${file.name}" couldn't be opened. It may be damaged.`)
          return
        }
        if (probe.status === 'ok') {
          setError(`"${file.name}" isn't password-protected — there's nothing to unlock.`)
          return
        }

        setBusy(false) // release the overlay so the password prompt is usable
        const unlocked = await unlockFile(file.name, bytes)
        if (!unlocked) return // skipped or failed — unlockFile already surfaced any error

        setPreview({
          title: 'Unlocked PDF',
          bytes: unlocked,
          fileName: `${baseName(file.name)}_unlocked.pdf`,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not unlock this file.')
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
          setBusy(true, 'Reading your file…')
          const bytes = new Uint8Array(await file.arrayBuffer())
          const probe = await probePdf(bytes)

          if (probe.status === 'damaged') {
            setError(`"${file.name}" couldn't be opened. It may be damaged.`)
            continue
          }

          let plaintext: Uint8Array = bytes
          let pageCount = probe.status === 'ok' ? probe.pageCount : 0

          if (probe.status === 'encrypted') {
            setBusy(false) // release the overlay so the prompt is usable
            const unlocked = await unlockFile(file.name, bytes)
            if (!unlocked) continue // skipped or failed
            plaintext = unlocked
            setBusy(true, 'Reading your file…')
            const after = await probePdf(plaintext)
            if (after.status !== 'ok') {
              setError(`"${file.name}" couldn't be read after unlocking.`)
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
      setBusy(true, 'Preparing your PDF…')
      const bytes = await buildPdf(sources, pages, { docAnnotations, assets })
      setPreview({ title: 'Your PDF is ready', bytes, fileName: outputName() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the PDF.')
    } finally {
      setBusy(false)
    }
  }, [sources, pages, docAnnotations, assets, outputName, setBusy])

  // -- Compress --------------------------------------------------------------
  const handleCompress = useCallback(async () => {
    try {
      setBusy(true, 'Compressing…')
      const assembled = await buildPdf(sources, pages, { docAnnotations, assets })
      const compressed = await compressPdf(assembled)

      // Is the current plan exactly the uploaded file, untouched? Only then is
      // the original upload a faithful stand-in for the user's document, so we
      // may fall back to it. Any delete/rotate/reorder/merge — or a watermark
      // / page numbers — makes it not pristine (re-assembly is the baseline).
      const pristine =
        docAnnotations.length === 0 &&
        sources.length === 1 &&
        pages.length === sources[0].pageCount &&
        pages.every(
          (p, i) => p.sourceId === sources[0].id && p.sourceIndex === i && p.rotation === 0,
        )

      // The document as it stands WITHOUT our compression — i.e. what the user
      // would otherwise download. For an untouched upload that's the original
      // file itself; pdf-lib re-assembly can duplicate shared resources (a font
      // or image reused across pages) and actually inflate the file.
      const baseline = pristine ? sources[0].bytes : assembled

      // Safety rule: never ship a result larger than that input. Pick the
      // smallest faithful representation of the document.
      let best = baseline
      if (assembled.length < best.length) best = assembled
      if (compressed.length < best.length) best = compressed

      const saved = baseline.length - best.length
      const pct = baseline.length > 0 ? Math.round((saved / baseline.length) * 100) : 0

      const info = (
        <div className="rounded-xl bg-cream-soft p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">Before</span>
            <span className="font-bold text-ink">{formatBytes(baseline.length)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-ink-soft">After</span>
            <span className="font-bold text-brand-600">{formatBytes(best.length)}</span>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-faint">
            <CompressIcon width={14} height={14} className="mt-0.5 flex-none" />
            {saved > 0
              ? `Reduced by ${pct}%. Savings depend on the file — image-heavy PDFs shrink less.`
              : `This PDF is already well optimised, so there's little to trim. Your file is unchanged.`}
          </p>
        </div>
      )

      setPreview({
        title: 'Compressed PDF',
        bytes: best,
        fileName: `${baseName(outputName())}_compressed.pdf`,
        info,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not compress the PDF.')
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
  const handleToolSelect = useCallback(
    (intent: ToolIntent) => {
      if (intent === 'unlock') {
        unlockFileInput.current?.click()
        return
      }
      if (intent === 'merge' || !hasPages) {
        setPendingTool(intent)
        toolFileInput.current?.click()
        return
      }
      if (intent === 'compress') {
        handleCompress()
        return
      }
      setMainMode({ kind: intent })
    },
    [hasPages, handleCompress],
  )

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
    else if (intent === 'compress') handleCompress()
    else if (intent === 'manage' || intent === 'merge') setMainMode({ kind: 'manage' })
    // 'unlock' never reaches here — handleToolSelect routes it to its own
    // file input before pendingTool is ever set.
  }, [hasPages, pendingTool, busy, handleCompress])

  // -- Start over ------------------------------------------------------------
  const handleReset = useCallback(() => {
    reset()
    setMainMode({ kind: 'browse' }) // don't carry a stale mode into the next upload
    sessionPassword.current = null // forget the cached password on Start over
    clearSession().catch(() => {})
  }, [reset])

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
        hasFile={hasPages}
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
        {/* Intro headline (only before any pages are loaded). */}
        {!hasPages && !recover && (
          <div className="mb-6 mt-2 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Edit your PDFs, right in your browser
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-ink-soft">
              Merge, split, rotate, delete, reorder and compress — free, and completely private.
              Your files never leave your device.
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

        {!hasPages ? (
          <>
            <DropZone
              onFiles={(files) => {
                // A plain upload clears any tool the user may have picked and
                // then cancelled, so it doesn't fire unexpectedly on load.
                setPendingTool(null)
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
        <WatermarkPanel onClose={() => setMainMode({ kind: 'browse' })} />
      )}

      {mainMode.kind === 'pageNumbers' && (
        <PageNumbersPanel onClose={() => setMainMode({ kind: 'browse' })} />
      )}

      {mainMode.kind === 'split' && (
        <SplitPanel
          baseName={baseName(outputName())}
          onClose={() => setMainMode({ kind: 'browse' })}
          onError={(m) => {
            setMainMode({ kind: 'browse' })
            setError(m)
          }}
        />
      )}

      {mainMode.kind === 'extract' && (
        <ExtractPanel
          baseName={baseName(outputName())}
          onClose={() => setMainMode({ kind: 'browse' })}
          onError={(m) => {
            setMainMode({ kind: 'browse' })
            setError(m)
          }}
          onExtracted={(bytes, fileName) => {
            setMainMode({ kind: 'browse' })
            setPreview({ title: 'Extracted pages', bytes, fileName })
          }}
        />
      )}

      {mainMode.kind === 'protect' && (
        <ProtectPanel
          baseName={baseName(outputName())}
          onClose={() => setMainMode({ kind: 'browse' })}
          onError={(m) => {
            setMainMode({ kind: 'browse' })
            setError(m)
          }}
          onProtected={(bytes, fileName) => {
            setMainMode({ kind: 'browse' })
            setPreview({
              title: 'Protected PDF',
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
                  <p className="font-bold text-ink">Your PDF is now password-protected.</p>
                  <p className="text-sm text-ink-soft">Download it below whenever you're ready.</p>
                </div>
              ),
            })
          }}
        />
      )}

      {mainMode.kind === 'ocr' && (
        <OcrPanel
          baseName={baseName(outputName())}
          onClose={() => setMainMode({ kind: 'browse' })}
          onError={(m) => {
            setMainMode({ kind: 'browse' })
            setError(m)
          }}
          onDone={(bytes, fileName) => {
            setMainMode({ kind: 'browse' })
            setPreview({ title: 'Searchable PDF', bytes, fileName })
          }}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Start over?"
          message="This will discard your current session and take you back to the upload screen. This can't be undone."
          confirmLabel="Discard and start over"
          cancelLabel="Keep working"
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
  return (
    <p className="mx-auto mt-5 flex max-w-2xl items-center justify-center gap-2 text-center text-xs text-ink-faint">
      <ShieldIcon width={14} height={14} className="flex-none text-brand-400" />
      All processing happens on your device. Nothing is uploaded to any server.
    </p>
  )
}
