import { useCallback, useEffect, useRef, useState } from 'react'
import { Header } from './shared/components/Header'
import { DropZone } from './shared/components/DropZone'
import { Workspace } from './features/page-management/workspace/Workspace'
import { Toolbar } from './features/page-management/workspace/Toolbar'
import { SplitPanel } from './features/page-management/split/SplitPanel'
import { ExtractPanel } from './features/page-management/split/ExtractPanel'
import { PreviewModal } from './shared/components/PreviewModal'
import { RecoverBanner } from './shared/components/RecoverBanner'
import { BusyOverlay } from './shared/components/BusyOverlay'
import { Toast } from './shared/components/Toast'
import { ToolGrid, type ToolIntent } from './shared/components/ToolGrid'
import { PasswordPrompt } from './shared/components/PasswordPrompt'
import { ShieldIcon, CompressIcon } from './shared/components/icons'
import { useStore } from './shared/state/store'
import { probePdf, decryptPdf, WrongPasswordError } from './shared/lib/pdfUnlock'
import { buildPdf } from './features/page-management/workspace/buildPdf'
import { compressPdf } from './features/page-management/compress/compressPdf'
import { formatBytes, baseName } from './shared/lib/format'
import { saveSession, loadSession, clearSession, type SavedSession } from './shared/lib/storage'

interface PreviewState {
  title: string
  bytes: Uint8Array
  fileName: string
  info?: React.ReactNode
}

export default function App() {
  const store = useStore()
  const {
    sources,
    pages,
    annotations,
    docAnnotations,
    assets,
    busy,
    busyMessage,
    addSource,
    rotateAll,
    reset,
    restore,
    setBusy,
    undo,
    redo,
  } = store

  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [showSplit, setShowSplit] = useState(false)
  const [showExtract, setShowExtract] = useState(false)
  const [recover, setRecover] = useState<SavedSession | null>(null)

  // A tool the user picked from the landing grid before uploading. Once a file
  // is loaded, the matching panel/action is opened (see the effect below).
  const [pendingTool, setPendingTool] = useState<ToolIntent | null>(null)
  const toolFileInput = useRef<HTMLInputElement>(null)

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
      if (session) setRecover(session)
    })
  }, [])

  // -- Reload recovery: quietly save the session as work changes (debounced) --
  useEffect(() => {
    // Don't save while the recover banner is still offering to restore, or
    // before the user has actually done anything.
    if (recover) return
    const t = setTimeout(() => {
      saveSession(sources, pages, annotations, docAnnotations, assets).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [sources, pages, annotations, docAnnotations, assets, recover])

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
      const bytes = await buildPdf(sources, pages, { annotations, docAnnotations, assets })
      setPreview({ title: 'Your PDF is ready', bytes, fileName: outputName() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the PDF.')
    } finally {
      setBusy(false)
    }
  }, [sources, pages, annotations, docAnnotations, assets, outputName, setBusy])

  // -- Compress --------------------------------------------------------------
  const handleCompress = useCallback(async () => {
    try {
      setBusy(true, 'Compressing…')
      const assembled = await buildPdf(sources, pages, { annotations, docAnnotations, assets })
      const compressed = await compressPdf(assembled)

      // Is the current plan exactly the uploaded file, untouched? Only then is
      // the original upload a faithful stand-in for the user's document, so we
      // may fall back to it. Any delete/rotate/reorder/merge — or any
      // annotation — makes it not pristine (re-assembly is the baseline then).
      const hasAnnotations =
        docAnnotations.length > 0 || Object.values(annotations).some((list) => list.length > 0)
      const pristine =
        !hasAnnotations &&
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
  }, [sources, pages, annotations, docAnnotations, assets, outputName, setBusy])

  // -- Tool discovery (landing grid) -----------------------------------------
  // Picking a tool remembers the intent, then opens the file picker so the
  // user drops straight into that tool once a file is loaded.
  const handleToolSelect = useCallback((intent: ToolIntent) => {
    setPendingTool(intent)
    toolFileInput.current?.click()
  }, [])

  // Once pages exist and a tool was requested, open that tool's panel/action.
  // merge/remove/rearrange have no panel — the workspace itself is the tool.
  useEffect(() => {
    // Wait until reading finishes (busy false) so panels open after the load
    // overlay clears and multi-file uploads don't fire a tool mid-read.
    if (!hasPages || !pendingTool || busy) return
    const intent = pendingTool
    setPendingTool(null)
    if (intent === 'split') setShowSplit(true)
    else if (intent === 'extract') setShowExtract(true)
    else if (intent === 'compress') handleCompress()
  }, [hasPages, pendingTool, busy, handleCompress])

  // -- Start over ------------------------------------------------------------
  const handleReset = useCallback(() => {
    reset()
    sessionPassword.current = null // forget the cached password on Start over
    clearSession().catch(() => {})
  }, [reset])

  // -- Recover banner actions ------------------------------------------------
  const handleRestore = useCallback(() => {
    if (recover) {
      restore(
        recover.sources,
        recover.pages,
        recover.annotations,
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
      <Header />

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
            <ToolGrid onSelect={handleToolSelect} disabled={busy} />
            <PrivacyNote />
          </>
        ) : (
          <div className="space-y-4">
            <Toolbar
              onAddFiles={handleFiles}
              onRotateAll={() => rotateAll(90)}
              onReset={handleReset}
              onSplit={() => setShowSplit(true)}
              onExtract={() => setShowExtract(true)}
              onCompress={handleCompress}
              onDownload={handleDownload}
              disabled={busy}
            />
            <Workspace />
            <PrivacyNote />
          </div>
        )}
      </main>

      {showSplit && (
        <SplitPanel
          baseName={baseName(outputName())}
          onClose={() => setShowSplit(false)}
          onError={(m) => {
            setShowSplit(false)
            setError(m)
          }}
        />
      )}

      {showExtract && (
        <ExtractPanel
          baseName={baseName(outputName())}
          onClose={() => setShowExtract(false)}
          onError={(m) => {
            setShowExtract(false)
            setError(m)
          }}
          onExtracted={(bytes, fileName) => {
            setShowExtract(false)
            setPreview({ title: 'Extracted pages', bytes, fileName })
          }}
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
