// Web Worker that runs the whole lossy compression job — pdf-lib parse, the
// image pass, and the re-save — off the main thread. Decoding and re-encoding
// dozens of full-page scans through canvas takes seconds and convertToBlob
// can't be interrupted, so on the main thread this would freeze the tab on
// exactly the files the feature exists for (features.md UX invariant:
// "Long-running operations (OCR, compress) run off the main thread with
// per-item progress").
//
// Keeping the entire job in here means only two byte transfers cross the
// worker boundary (the PDF in, the PDF out) rather than one per image.
import { recompressImages, type CompressLevel } from './recompressImages'

export interface CompressRequest {
  bytes: ArrayBuffer
  level: CompressLevel
}

export type CompressResponse =
  | { type: 'progress'; done: number; total: number }
  | { type: 'done'; bytes: ArrayBuffer; replaced: number; candidates: number }
  | { type: 'error'; message: string }

// The project's tsconfig uses the DOM lib, which types the global `self` as a
// Window. Narrowing to just the two members a worker entry needs is cheaper —
// and less invasive — than pulling the webworker lib into the whole program.
interface WorkerScope {
  onmessage: ((event: MessageEvent<CompressRequest>) => void) | null
  postMessage(message: CompressResponse, transfer?: Transferable[]): void
}
const ctx = self as unknown as WorkerScope

ctx.onmessage = async (event: MessageEvent<CompressRequest>) => {
  const { bytes, level } = event.data
  try {
    const result = await recompressImages(new Uint8Array(bytes), level, (progress) => {
      ctx.postMessage({ type: 'progress', ...progress })
    })
    // Transfer rather than copy — these buffers are megabytes.
    const out = result.bytes.buffer.slice(
      result.bytes.byteOffset,
      result.bytes.byteOffset + result.bytes.byteLength,
    ) as ArrayBuffer
    ctx.postMessage(
      { type: 'done', bytes: out, replaced: result.replaced, candidates: result.candidates },
      [out],
    )
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Could not compress the images in this PDF.',
    })
  }
}
