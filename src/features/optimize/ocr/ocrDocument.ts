// Sequential OCR recognition pipeline (decision D7). Recognition only: this
// module renders pages and returns structured per-page text/word data — it
// does NOT write anything back into the source PDF. Drawing an invisible
// searchable text layer from these results is a separate, later task.
//
// D19: logic-only for this work cycle. Nothing here is wired into any UI —
// onProgress is a plain callback parameter for a future progress bar to use.
import type { Rect } from '../../../shared/state/types'
import { getPageCount, getTextContent, renderPageForOcr, forgetDoc } from '../../../shared/lib/pdfjs'
import { getOcrWorker } from './ocrWorker'

/**
 * Shown to the user before starting OCR (decision D7's UI-disclosure
 * requirement) — a plain string for a future banner/dialog to render; no UI
 * is built here.
 */
export const OCR_SPEED_DISCLOSURE =
  "OCR runs entirely on your device, which is slower and less accurate than cloud-based OCR services — recognizing a large document can take a while. Your file never leaves your browser."

/**
 * A page counts as "already has a real text layer" once its pdf.js text
 * content adds up to at least this many non-whitespace characters.
 *
 * Reasoning: a genuinely scanned page can still carry a handful of real text
 * objects — a page-number stamp, a "Confidential" watermark, a signature
 * block — that are only a few characters long. Treating those as "has text"
 * would skip OCR and leave the actual scanned content unsearchable. 20 is
 * comfortably above any such stray label but far below even a sparse
 * paragraph of real body text, so it separates the two cases without
 * per-document tuning.
 */
const MIN_TEXT_LAYER_CHARS = 20

/** Whether a page already has a real text layer (vs. stray/empty content). */
export async function hasTextLayer(
  sourceId: string,
  bytes: Uint8Array,
  pageIndex: number,
): Promise<boolean> {
  const text = await getTextContent(sourceId, bytes, pageIndex)
  return text.replace(/\s+/g, '').length >= MIN_TEXT_LAYER_CHARS
}

/** One recognized word, in the same normalized-rect convention as Annotation.rect. */
export interface OcrWord {
  text: string
  /** Tesseract's own 0-100 confidence scale. */
  confidence: number
  /** Normalized 0..1, top-left origin, relative to the rendered page image. */
  rect: Rect
}

export interface PageOcrResult {
  /** 0-based page index. */
  pageIndex: number
  status: 'skipped' | 'recognized'
  /** Recognized text; empty for skipped pages (they already have a real text layer). */
  text: string
  /** Word-level detail for a future searchable-text-layer step; empty for skipped pages. */
  words: OcrWord[]
  /** Tesseract's overall page confidence (0-100); null for skipped pages. */
  confidence: number | null
}

export interface OcrProgressInfo {
  pageIndex: number
  pageCount: number
  status: 'skipped' | 'recognizing' | 'done'
}

export interface OcrOptions {
  languages: string[]
  onProgress?: (info: OcrProgressInfo) => void
}

// Render width used as OCR input. High enough that small print stays legible
// (roughly 300dpi-equivalent for a standard letter/A4 page width) without
// ballooning memory/recognition time the way a full-resolution render would.
const RENDER_WIDTH = 2000

/**
 * Run OCR recognition over every page of a PDF, sequentially (never in
 * parallel — decision D7). Pages that already have a real text layer are
 * skipped; each remaining page is rendered to an image and recognized
 * through the shared, per-language Tesseract worker (ocrWorker.ts).
 */
export async function ocrDocument(
  sourceBytes: Uint8Array,
  options: OcrOptions,
): Promise<PageOcrResult[]> {
  const language = options.languages.join('+')
  // Scoped id for pdf.js's internal doc cache (shared/lib/pdfjs.ts) — this
  // isn't one of the app's stored SourceDoc ids, just a private key for the
  // duration of this call, forgotten again in `finally`.
  const sourceId = `ocr:${crypto.randomUUID()}`

  const pageCount = await getPageCount(sourceBytes)
  const results: PageOcrResult[] = []

  try {
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const skip = await hasTextLayer(sourceId, sourceBytes, pageIndex)

      if (skip) {
        options.onProgress?.({ pageIndex, pageCount, status: 'skipped' })
        results.push({ pageIndex, status: 'skipped', text: '', words: [], confidence: null })
        continue
      }

      options.onProgress?.({ pageIndex, pageCount, status: 'recognizing' })

      const { dataUrl, width, height } = await renderPageForOcr(
        sourceId,
        sourceBytes,
        pageIndex,
        RENDER_WIDTH,
      )
      const worker = await getOcrWorker(language)
      const { data } = await worker.recognize(dataUrl, {}, { text: true, blocks: true })

      const words: OcrWord[] = []
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              const { x0, y0, x1, y1 } = word.bbox
              words.push({
                text: word.text,
                confidence: word.confidence,
                rect: {
                  x: x0 / width,
                  y: y0 / height,
                  w: (x1 - x0) / width,
                  h: (y1 - y0) / height,
                },
              })
            }
          }
        }
      }

      results.push({
        pageIndex,
        status: 'recognized',
        text: data.text,
        words,
        confidence: data.confidence,
      })
      options.onProgress?.({ pageIndex, pageCount, status: 'done' })
    }
  } finally {
    forgetDoc(sourceId)
  }

  return results
}
