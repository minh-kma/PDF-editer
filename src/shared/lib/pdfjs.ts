// Thin wrapper around pdf.js (Mozilla) used ONLY for rendering page pictures
// (thumbnails and previews). All actual PDF editing is done with pdf-lib.
import * as pdfjsLib from 'pdfjs-dist'
// Vite gives us a URL to the worker file; pdf.js does its heavy work there so
// the page stays responsive.
import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl

// Cache parsed documents by source id so we don't re-parse a file for every
// page thumbnail. Lives outside React on purpose.
const docCache = new Map<string, Promise<pdfjsLib.PDFDocumentProxy>>()

function loadDoc(sourceId: string, bytes: Uint8Array): Promise<pdfjsLib.PDFDocumentProxy> {
  let doc = docCache.get(sourceId)
  if (!doc) {
    // pdf.js may detach the buffer it's given, so hand it a private copy and
    // keep the caller's original bytes intact.
    doc = pdfjsLib.getDocument({ data: bytes.slice() }).promise
    docCache.set(sourceId, doc)
  }
  return doc
}

export function forgetDoc(sourceId: string) {
  const doc = docCache.get(sourceId)
  docCache.delete(sourceId)
  doc?.then((d) => d.destroy()).catch(() => {})
}

export async function getPageCount(bytes: Uint8Array): Promise<number> {
  const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
  const count = doc.numPages
  await doc.destroy()
  return count
}

export type PdfOpenResult =
  | { status: 'ok'; pageCount: number }
  | { status: 'needsPassword' } // user-password encrypted
  | { status: 'error' } // damaged / unreadable

/**
 * Try to open a PDF for probing: returns its page count, or flags that it needs
 * a user password, or that it's unreadable. pdf.js is authoritative here — it's
 * the render engine and raises a `PasswordException` for user-password files.
 */
export async function openPdf(bytes: Uint8Array): Promise<PdfOpenResult> {
  try {
    const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise
    const pageCount = doc.numPages
    await doc.destroy()
    return { status: 'ok', pageCount }
  } catch (err) {
    if (err && (err as { name?: string }).name === 'PasswordException') {
      return { status: 'needsPassword' }
    }
    return { status: 'error' }
  }
}

/**
 * Render one page to a PNG data URL.
 * @param rotation extra rotation (0/90/180/270) applied on top of the page's own.
 * @param maxWidth target width in CSS pixels; height scales to keep aspect ratio.
 */
export async function renderPage(
  sourceId: string,
  bytes: Uint8Array,
  pageIndex: number,
  rotation: number,
  maxWidth: number,
): Promise<string> {
  const doc = await loadDoc(sourceId, bytes)
  const page = await doc.getPage(pageIndex + 1) // pdf.js pages are 1-based
  const base = page.getViewport({ scale: 1 })
  const scale = maxWidth / base.width
  const viewport = page.getViewport({ scale, rotation })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get a drawing surface for the thumbnail.')

  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas.toDataURL('image/png')
}
