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
 * Concatenated text content of one page, via pdf.js's text layer extraction.
 * Used to detect whether a page already has a real text layer (e.g. for OCR
 * skip-detection) — reading only, never editing (pdf.js draws/reads, pdf-lib
 * edits).
 */
export async function getTextContent(
  sourceId: string,
  bytes: Uint8Array,
  pageIndex: number,
): Promise<string> {
  const doc = await loadDoc(sourceId, bytes)
  const page = await doc.getPage(pageIndex + 1)
  const content = await page.getTextContent()
  return content.items.map((item) => ('str' in item ? item.str : '')).join('')
}

/** One pdf.js text run, as needed by Edit Text (decision D6) — deliberately
 * thin (no filtering/merging), that's a feature-level concern. */
export interface PageTextRun {
  text: string
  /** PDF text-rendering matrix [a, b, c, d, e, f]; (e, f) is the baseline start. */
  transform: number[]
  /** Run width, in PDF points. */
  width: number
  /** Run height, in PDF points (pdf.js's own font-metric estimate). */
  height: number
}

/**
 * Raw per-run text content for one page, plus the page's own (unrotated)
 * MediaBox size those run coordinates are relative to — via pdf.js's `view`,
 * matching pdf-lib's `page.getSize()` (both are the raw MediaBox, so Edit
 * Text's rects need no rotation adjustment when baked back with pdf-lib).
 */
export async function getPageTextRuns(
  sourceId: string,
  bytes: Uint8Array,
  pageIndex: number,
): Promise<{ runs: PageTextRun[]; width: number; height: number }> {
  const doc = await loadDoc(sourceId, bytes)
  const page = await doc.getPage(pageIndex + 1)
  const content = await page.getTextContent()
  const [x0, y0, x1, y1] = page.view
  // pdf.js's TextItem type isn't re-exported from the package's main type
  // entry, so narrow inline (same technique getTextContent uses) rather
  // than naming it.
  const runs: PageTextRun[] = []
  for (const item of content.items) {
    if (!('str' in item)) continue
    runs.push({ text: item.str, transform: item.transform, width: item.width, height: item.height })
  }
  return { runs, width: x1 - x0, height: y1 - y0 }
}

async function renderPageToCanvas(
  sourceId: string,
  bytes: Uint8Array,
  pageIndex: number,
  rotation: number,
  maxWidth: number,
): Promise<HTMLCanvasElement> {
  const doc = await loadDoc(sourceId, bytes)
  const page = await doc.getPage(pageIndex + 1) // pdf.js pages are 1-based
  const base = page.getViewport({ scale: 1 })
  const scale = maxWidth / base.width
  const viewport = page.getViewport({ scale, rotation })

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get a drawing surface for rendering.')

  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
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
  const canvas = await renderPageToCanvas(sourceId, bytes, pageIndex, rotation, maxWidth)
  return canvas.toDataURL('image/png')
}

/**
 * Render one page for OCR input: a PNG data URL plus the exact pixel
 * dimensions it was rendered at, so word bounding boxes (in that same pixel
 * space) can be normalized back to 0..1 page-relative coordinates.
 */
export async function renderPageForOcr(
  sourceId: string,
  bytes: Uint8Array,
  pageIndex: number,
  maxWidth: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const canvas = await renderPageToCanvas(sourceId, bytes, pageIndex, 0, maxWidth)
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }
}
