// Compress — recompresses the embedded raster images, then re-saves with
// object streams. Runs entirely in the browser; no bytes are ever sent
// anywhere.
//
// Lossy BY EXPLICIT USER CHOICE (Low/Medium/High), reversing the original
// lossless-only rule: structural re-saving alone leaves every image stream
// byte-identical, so it barely moved the needle on the scans and photo PDFs
// people actually want to shrink. Only raster images change — text, vector
// graphics and fonts are untouched (see recompressImages.ts).
import { PDFDocument } from 'pdf-lib'
import {
  canRecompressImages,
  type CompressLevel,
  type RecompressProgress,
} from './recompressImages'
import type { CompressRequest, CompressResponse } from './compressWorker'

export type { CompressLevel } from './recompressImages'
export { COMPRESSION_LEVELS } from './recompressImages'

export interface CompressResult {
  bytes: Uint8Array
  /** Images actually replaced with a smaller version. */
  replaced: number
  /** Images considered (photos/scans we can safely handle). */
  candidates: number
  /** False when the browser can't do canvas image encoding — the result is
   *  then the lossless re-save only, and the UI should say so. */
  imagesSupported: boolean
}

/** The original lossless behaviour, still used as the no-canvas fallback. */
async function losslessResave(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes.slice())
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}

/**
 * Compress an assembled PDF at the chosen level, reporting per-image progress.
 * The image work happens in a dedicated worker so the UI stays responsive.
 */
export async function compressPdf(
  bytes: Uint8Array,
  level: CompressLevel,
  onProgress?: (progress: RecompressProgress) => void,
): Promise<CompressResult> {
  if (!canRecompressImages()) {
    return {
      bytes: await losslessResave(bytes),
      replaced: 0,
      candidates: 0,
      imagesSupported: false,
    }
  }

  const worker = new Worker(new URL('./compressWorker.ts', import.meta.url), { type: 'module' })

  try {
    return await new Promise<CompressResult>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<CompressResponse>) => {
        const message = event.data
        if (message.type === 'progress') {
          onProgress?.({ done: message.done, total: message.total })
        } else if (message.type === 'done') {
          resolve({
            bytes: new Uint8Array(message.bytes),
            replaced: message.replaced,
            candidates: message.candidates,
            imagesSupported: true,
          })
        } else {
          reject(new Error(message.message))
        }
      }
      worker.onerror = () => reject(new Error('Could not compress this PDF.'))

      // Copy before transferring: the caller still needs its own bytes for the
      // before/after comparison.
      const copy = bytes.slice()
      const request: CompressRequest = { bytes: copy.buffer as ArrayBuffer, level }
      worker.postMessage(request, [request.bytes])
    })
  } finally {
    worker.terminate()
  }
}
