// Dedicated Web Worker wrapper around Tesseract.js (decision D7). This is the
// only place the codebase talks to Tesseract.js — recognition always runs
// inside the Worker that Tesseract.js's own createWorker() spawns
// internally, so it never touches the main thread.
//
// Asset bundling follows the same convention already used for pdf.js's own
// worker (shared/lib/pdfjs.ts) and qpdf-wasm (shared/lib/pdfUnlock.ts,
// features/security/protect/protectPdf.ts): the engine/worker scripts are
// bundled as static, same-origin assets via Vite's `?url` import, never a
// CDN, so the app stays offline-capable. Per-language `.traineddata` files
// are the one deliberate exception — those come from Tesseract's default CDN
// on first use (see OCR_SPEED_DISCLOSURE in ocrDocument.ts); bundling every
// possible language locally isn't practical, and D7 explicitly allows this
// one network path.
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js'
// Tesseract.js's own worker bootstrap script — runs inside the spawned Worker.
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url'
// The OCR engine itself (Emscripten/wasm). The "-lstm" build matches
// createWorker's default OEM (LSTM_ONLY) — the only mode this app uses — and
// is smaller than the combined legacy+LSTM build. Its .wasm binary is
// embedded inline as base64 in this file, so no separate .wasm asset needs
// bundling or a locateFile hook.
import tesseractCoreUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'

/**
 * One Tesseract worker per language(-combination), created lazily and kept
 * for the rest of the session. Requesting the same language again — the next
 * page, the rest of the document, or a second document opened later in the
 * same session — reuses this worker instead of spawning a new one or
 * re-fetching its language model.
 */
const workerCache = new Map<string, Promise<TesseractWorker>>()

/** Get (or lazily create) the shared Tesseract worker for a language. */
export function getOcrWorker(language: string): Promise<TesseractWorker> {
  let worker = workerCache.get(language)
  if (!worker) {
    worker = createWorker(language, undefined, {
      workerPath: tesseractWorkerUrl,
      corePath: tesseractCoreUrl,
    })
    // If creation fails (e.g. the language model fetch fails), don't leave a
    // rejected promise permanently cached — a later retry should try again.
    worker.catch(() => workerCache.delete(language))
    workerCache.set(language, worker)
  }
  return worker
}
