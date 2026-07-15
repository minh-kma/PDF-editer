// Safe, lossless "compression", powered by pdf-lib. Runs entirely in the
// browser — no bytes are ever sent anywhere.
import { PDFDocument } from 'pdf-lib'

/**
 * Safe, lossless "compression": re-save the assembled PDF with object streams,
 * which removes wasted structure and often shrinks the file. Honest note for
 * the UI: savings vary a lot by file and can be small for image-heavy PDFs.
 */
export async function compressPdf(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes.slice())
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}
