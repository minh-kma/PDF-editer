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
import { ShieldIcon, CompressIcon } from './shared/components/icons'
import { useStore } from './shared/state/store'
import { getPageCount } from './shared/lib/pdfjs'
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
  const { sources, pages, busy, busyMessage, addSource, rotateAll, reset, restore, setBusy } = store

  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [showSplit, setShowSplit] = useState(false)
  const [showExtract, setShowExtract] = useState(false)
  const [recover, setRecover] = useState<SavedSession | null>(null)

  // A tool the user picked from the landing grid before uploading. Once a file
  // is loaded, the matching panel/action is opened (see the effect below).
  const [pendingTool, setPendingTool] = useState<ToolIntent | null>(null)
  const toolFileInput = useRef<HTMLInputElement>(null)

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
      saveSession(sources, pages).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [sources, pages, recover])

  // -- File upload -----------------------------------------------------------
  const handleFiles = useCallback(
    async (files: File[]) => {
      setBusy(true, files.length > 1 ? 'Reading your files…' : 'Reading your file…')
      try {
        for (const file of files) {
          const bytes = new Uint8Array(await file.arrayBuffer())
          let pageCount: number
          try {
            pageCount = await getPageCount(bytes)
          } catch {
            setError(
              `"${file.name}" couldn't be opened. It may be damaged or password-protected.`,
            )
            continue
          }
          addSource({ id: crypto.randomUUID(), name: file.name, bytes, pageCount })
        }
      } finally {
        setBusy(false)
      }
    },
    [addSource, setBusy],
  )

  // -- Download (build the assembled PDF, then preview) ----------------------
  const handleDownload = useCallback(async () => {
    try {
      setBusy(true, 'Preparing your PDF…')
      const bytes = await buildPdf(sources, pages)
      setPreview({ title: 'Your PDF is ready', bytes, fileName: outputName() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the PDF.')
    } finally {
      setBusy(false)
    }
  }, [sources, pages, outputName, setBusy])

  // -- Compress --------------------------------------------------------------
  const handleCompress = useCallback(async () => {
    try {
      setBusy(true, 'Compressing…')
      const assembled = await buildPdf(sources, pages)
      const compressed = await compressPdf(assembled)

      // Is the current plan exactly the uploaded file, untouched? Only then is
      // the original upload a faithful stand-in for the user's document, so we
      // may fall back to it. Any delete/rotate/reorder/merge makes it not
      // pristine (and re-assembly is then the correct baseline instead).
      const pristine =
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
  }, [sources, pages, outputName, setBusy])

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
    clearSession().catch(() => {})
  }, [reset])

  // -- Recover banner actions ------------------------------------------------
  const handleRestore = useCallback(() => {
    if (recover) {
      restore(recover.sources, recover.pages)
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
