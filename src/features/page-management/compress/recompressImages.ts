// Lossy image recompression — the part of Compress that actually shrinks
// scanned and photo-heavy PDFs. Runs entirely in the browser (normally inside
// compressWorker.ts, off the main thread).
//
// Mechanism: pdf-lib's high-level embedJpg/embedPng can only ADD a new image
// to a document, never swap one that existing page content already draws. So
// this works at the object layer instead — walk every indirect object, find
// the image XObjects, and `context.assign` a re-encoded stream onto the SAME
// PDFRef. Because the reference is unchanged, every page that draws that image
// keeps working untouched: no page copying, no resource-dictionary rewriting,
// and none of the shared-resource duplication that a copy pipeline risks.
//
// Only raster image XObjects are ever replaced. Content streams, fonts, vector
// graphics, annotations and form fields cannot match the predicate below, so
// text stays selectable and vectors stay resolution-independent.
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} from 'pdf-lib'

export type CompressLevel = 'low' | 'medium' | 'high'

export interface LevelSpec {
  /** JPEG quality passed to canvas encoding, 0..1. */
  quality: number
  /** Images above this effective resolution are scaled down to it. */
  dpiCap: number
}

/**
 * The quality/resolution trade per level.
 *
 * 150 DPI is the long-established screen-reading sweet spot (Ghostscript's
 * /ebook preset and Acrobat's "Reduce File Size" both land there) — halving a
 * 300 DPI scan to it drops three quarters of the pixels before JPEG quality is
 * even considered, which is where most of the saving comes from. Quality 0.82
 * is the usual "can't tell" threshold; 0.65 is findable at 100% zoom but not at
 * reading size; 0.45 is deliberately aggressive, for hitting an email limit.
 *
 * Low caps at 220 rather than 300 on purpose: a level that visibly does nothing
 * to an ordinary 300 DPI scan reads as a broken feature.
 */
export const COMPRESSION_LEVELS: Record<CompressLevel, LevelSpec> = {
  low: { quality: 0.82, dpiCap: 220 },
  medium: { quality: 0.65, dpiCap: 150 },
  high: { quality: 0.45, dpiCap: 110 },
}

export interface RecompressProgress {
  /** Candidate images finished so far. */
  done: number
  /** Candidate images found — not every image in the file (see screening). */
  total: number
}

export interface RecompressResult {
  bytes: Uint8Array
  /** How many images were actually replaced (a candidate that didn't get
   *  smaller keeps its original stream and doesn't count). */
  replaced: number
  /** How many images were considered. */
  candidates: number
}

/**
 * Whether this browser can do the canvas work at all. OffscreenCanvas'
 * convertToBlob is missing on Safari before 16.4 — there the caller falls back
 * to the lossless-only re-save rather than half-doing the job.
 */
export function canRecompressImages(): boolean {
  return (
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvas.prototype.convertToBlob === 'function' &&
    typeof createImageBitmap === 'function'
  )
}

// -- screening --------------------------------------------------------------

// Filters whose output is raw samples we can rebuild pixels from. DCTDecode is
// handled separately (its bytes are already a complete JPEG file, and pdf-lib's
// decodePDFRawStream throws on it). Everything else — JPXDecode, JBIG2Decode,
// CCITTFaxDecode — is left alone: browsers can't decode JPEG 2000, and bitonal
// fax scans are already smaller than any JPEG we'd produce from them.
const RAW_FILTERS = ['FlateDecode', 'LZWDecode', 'ASCII85Decode', 'ASCIIHexDecode']

/** Below these, recompression isn't worth the time or the quality risk. */
const MIN_PIXELS_PER_SIDE = 64
const MIN_STREAM_BYTES = 16 * 1024

type Kind = 'jpeg' | 'raw'

/** Component count if this colour space is one we can safely rebuild, else 0. */
function colorComponents(dict: PDFDict): number {
  const cs = dict.lookup(PDFName.of('ColorSpace'))
  // A JPEG carries its own colour space; a missing entry is fine there.
  if (!cs) return 3
  if (cs instanceof PDFName) {
    if (cs === PDFName.of('DeviceRGB')) return 3
    if (cs === PDFName.of('DeviceGray')) return 1
    return 0 // DeviceCMYK, Pattern, …
  }
  // ICCBased: [/ICCBased <stream>] — the stream's /N gives the component count.
  if (cs instanceof PDFArray && cs.size() === 2 && cs.lookup(0) === PDFName.of('ICCBased')) {
    const streamDict = cs.lookup(1)
    const n =
      streamDict instanceof PDFRawStream
        ? streamDict.dict.lookup(PDFName.of('N'), PDFNumber).asNumber()
        : 0
    return n === 1 || n === 3 ? n : 0
  }
  // Indexed, Separation, DeviceN, Lab — colour would shift, so skip.
  return 0
}

/**
 * Decide whether an image XObject is one we can recompress safely, and how its
 * bytes should be read. Anything uncertain returns null and is left untouched.
 */
function screen(stream: PDFRawStream): Kind | null {
  const dict = stream.dict
  if (dict.lookup(PDFName.of('Subtype')) !== PDFName.of('Image')) return null

  // Transparency: JPEG can't carry an alpha channel, and flattening a cut-out
  // logo onto white visibly wrecks it. Product decision — these are skipped at
  // every level, not just the gentle ones.
  if (dict.lookup(PDFName.of('SMask'))) return null
  if (dict.lookup(PDFName.of('Mask'))) return null
  const imageMask = dict.lookup(PDFName.of('ImageMask'))
  if (imageMask && imageMask.toString() === 'true') return null

  const width = dict.lookup(PDFName.of('Width'), PDFNumber).asNumber()
  const height = dict.lookup(PDFName.of('Height'), PDFNumber).asNumber()
  if (width < MIN_PIXELS_PER_SIDE || height < MIN_PIXELS_PER_SIDE) return null
  if (stream.contents.length < MIN_STREAM_BYTES) return null

  if (colorComponents(dict) === 0) return null

  // A filter chain (e.g. [/ASCII85Decode /DCTDecode]) is rare and fiddly —
  // not worth the edge cases.
  const filter = dict.lookup(PDFName.of('Filter'))
  if (!(filter instanceof PDFName)) return null

  if (filter === PDFName.of('DCTDecode')) return 'jpeg'
  if (!RAW_FILTERS.includes(filter.asString().replace('/', ''))) return null

  // Raw samples: we only rebuild the straightforward 8-bit case.
  const bpc = dict.lookup(PDFName.of('BitsPerComponent'))
  if (!(bpc instanceof PDFNumber) || bpc.asNumber() !== 8) return null
  if (dict.lookup(PDFName.of('Decode'))) return null // inverted/custom ranges

  return 'raw'
}

// -- displayed-resolution estimate ------------------------------------------

/**
 * Widest page (in points) that draws each image, keyed by ref tag.
 *
 * True displayed size would mean resolving the transform at every draw
 * operator, which pdf-lib gives no reader for. Assuming the image spans the
 * page is essentially exact for scans and full-page photos — the whole point of
 * this feature — and for a small logo on a big page it UNDER-estimates the DPI,
 * so we downsample less than we could. Conservative in the right direction.
 */
function mapImagesToPageWidths(doc: PDFDocument): Map<string, number> {
  const widths = new Map<string, number>()

  const visit = (resources: PDFDict | undefined, pageWidthPt: number, depth: number) => {
    if (!resources || depth > 4) return
    const xobjects = resources.lookupMaybe(PDFName.of('XObject'), PDFDict)
    if (!xobjects) return

    for (const [, value] of xobjects.entries()) {
      if (!(value instanceof PDFRef)) continue
      const target = doc.context.lookup(value)
      if (!(target instanceof PDFRawStream)) continue

      const subtype = target.dict.lookup(PDFName.of('Subtype'))
      if (subtype === PDFName.of('Image')) {
        const prev = widths.get(value.tag) ?? 0
        if (pageWidthPt > prev) widths.set(value.tag, pageWidthPt)
      } else if (subtype === PDFName.of('Form')) {
        // A form XObject can hold images of its own.
        visit(target.dict.lookupMaybe(PDFName.of('Resources'), PDFDict), pageWidthPt, depth + 1)
      }
    }
  }

  for (const page of doc.getPages()) visit(page.node.Resources(), page.getWidth(), 0)
  return widths
}

// -- pixels -----------------------------------------------------------------

/** Raw 8-bit samples (1 or 3 components) → an RGBA ImageData. */
function samplesToImageData(
  samples: Uint8Array,
  width: number,
  height: number,
  components: number,
): ImageData | null {
  const expected = width * height * components
  if (samples.length < expected) return null

  const rgba = new Uint8ClampedArray(width * height * 4)
  for (let i = 0, s = 0, d = 0; i < width * height; i++, s += components, d += 4) {
    if (components === 1) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = samples[s]
    } else {
      rgba[d] = samples[s]
      rgba[d + 1] = samples[s + 1]
      rgba[d + 2] = samples[s + 2]
    }
    rgba[d + 3] = 255
  }
  return new ImageData(rgba, width, height)
}

/** Decode one screened image into something drawable. */
async function decodeImage(
  stream: PDFRawStream,
  kind: Kind,
): Promise<ImageBitmap | ImageData | null> {
  if (kind === 'jpeg') {
    // A DCTDecode stream's contents ARE a complete JPEG file — hand them
    // straight to the browser's decoder.
    const copy = stream.contents.slice()
    return createImageBitmap(new Blob([copy], { type: 'image/jpeg' }))
  }

  const width = stream.dict.lookup(PDFName.of('Width'), PDFNumber).asNumber()
  const height = stream.dict.lookup(PDFName.of('Height'), PDFNumber).asNumber()
  const components = colorComponents(stream.dict)
  const samples = decodePDFRawStream(stream).decode()
  return samplesToImageData(samples, width, height, components)
}

/** Draw the decoded image at `scale` and encode it as JPEG. */
async function encodeJpeg(
  image: ImageBitmap | ImageData,
  scale: number,
  quality: number,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (image instanceof ImageData) {
    if (scale === 1) {
      ctx.putImageData(image, 0, 0)
    } else {
      // putImageData ignores transforms, so bounce through a full-size canvas.
      const full = new OffscreenCanvas(image.width, image.height)
      const fullCtx = full.getContext('2d')
      if (!fullCtx) return null
      fullCtx.putImageData(image, 0, 0)
      ctx.drawImage(full, 0, 0, width, height)
    }
  } else {
    ctx.drawImage(image, 0, 0, width, height)
  }

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height }
}

// -- the pass ---------------------------------------------------------------

/**
 * Recompress every eligible embedded image and return the re-saved PDF.
 * Non-image content is untouched by construction — only objects that are both
 * a PDFRawStream and `/Subtype /Image` are ever assigned over.
 */
export async function recompressImages(
  bytes: Uint8Array,
  level: CompressLevel,
  onProgress?: (progress: RecompressProgress) => void,
): Promise<RecompressResult> {
  const { quality, dpiCap } = COMPRESSION_LEVELS[level]
  const doc = await PDFDocument.load(bytes.slice())

  const candidates: { ref: PDFRef; stream: PDFRawStream; kind: Kind }[] = []
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    try {
      const kind = screen(obj)
      if (kind) candidates.push({ ref, stream: obj, kind })
    } catch {
      // A malformed image dict (missing /Width, wrong types) makes pdf-lib's
      // typed lookups throw. Treat it as "not a candidate" and move on.
    }
  }

  const pageWidths = mapImagesToPageWidths(doc)
  let replaced = 0
  let done = 0
  onProgress?.({ done, total: candidates.length })

  for (const { ref, stream, kind } of candidates) {
    try {
      const image = await decodeImage(stream, kind)
      if (image) {
        // Scale so the image lands at the level's DPI cap on the page that
        // draws it. Never upscale; an unreferenced image is left at 1:1 and
        // only gets the quality change.
        const pageWidthPt = pageWidths.get(ref.tag)
        const scale = pageWidthPt
          ? Math.min(1, dpiCap / (image.width / (pageWidthPt / 72)))
          : 1

        const encoded = await encodeJpeg(image, scale, quality)
        // Per-image floor: if re-encoding didn't actually save anything, keep
        // the original bytes. No image is ever degraded for no gain.
        if (encoded && encoded.bytes.length < stream.contents.length) {
          const dict = doc.context.obj({
            Type: 'XObject',
            Subtype: 'Image',
            Width: encoded.width,
            Height: encoded.height,
            ColorSpace: 'DeviceRGB',
            BitsPerComponent: 8,
            Filter: 'DCTDecode',
          })
          // Built fresh rather than mutated, so stale /DecodeParms, /Decode and
          // colour-space entries can't survive onto the new JPEG.
          doc.context.assign(ref, PDFRawStream.of(dict, encoded.bytes))
          replaced++
        }
        if (image instanceof ImageBitmap) image.close()
      }
    } catch {
      // One unreadable image must not fail the whole document — leave it as it
      // was and carry on.
    }
    done++
    onProgress?.({ done, total: candidates.length })
  }

  // Same structural re-save Compress has always done — the object-stream win is
  // kept on top of the image saving, not replaced by it.
  const out = await doc.save({ useObjectStreams: true, addDefaultPage: false })
  return { bytes: out, replaced, candidates: candidates.length }
}
