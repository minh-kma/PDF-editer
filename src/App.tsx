import { useCallback, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { DropZone } from './components/DropZone'
import { Workspace } from './components/Workspace'
import { Toolbar } from './components/Toolbar'
import { SplitPanel } from './components/SplitPanel'
import { PreviewModal } from './components/PreviewModal'
import { RecoverBanner } from './components/RecoverBanner'
import { BusyOverlay } from './components/BusyOverlay'
import { Toast } from './components/Toast'
import { ShieldIcon, CompressIcon } from './components/icons'
import { useStore } from './state/store'
import { getPageCount } from './lib/pdfjs'
import { buildPdf, compressPdf } from './lib/pdfEdit'
import { formatBytes, baseName } from './lib/format'
import { saveSession, loadSession, clearSession, type SavedSession } from './lib/storage'

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
  const [recover, setRecover] = useState<SavedSession | null>(null)

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
      const original = await buildPdf(sources, pages)
      const compressed = await compressPdf(original)
      // Keep whichever is smaller — compression is best-effort.
      const best = compressed.length < original.length ? compressed : original
      const saved = original.length - best.length
      const pct = original.length > 0 ? Math.round((saved / original.length) * 100) : 0

      const info = (
        <div className="rounded-xl bg-cream-soft p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-soft">Before</span>
            <span className="font-bold text-ink">{formatBytes(original.length)}</span>
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
            <DropZone onFiles={handleFiles} disabled={busy} />
            <PrivacyNote />
          </>
        ) : (
          <div className="space-y-4">
            <Toolbar
              onAddFiles={handleFiles}
              onRotateAll={() => rotateAll(90)}
              onReset={handleReset}
              onSplit={() => setShowSplit(true)}
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

      {preview && (
        <PreviewModal
          title={preview.title}
          bytes={preview.bytes}
          fileName={preview.fileName}
          info={preview.info}
          onClose={() => setPreview(null)}
        />
      )}

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
