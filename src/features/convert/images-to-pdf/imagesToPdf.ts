// Images to PDF: embed JPG/PNG images as PDF pages with pdf-lib. Runs entirely
// in the browser — no bytes are ever sent anywhere. This is the JPG/PNG half of
// decisions.md D4's conversion exception.
import { PDFDocument, PageSizes, degrees, type PDFImage } from 'pdf-lib'

export type PageSizeId = 'fit' | 'a4' | 'letter' | 'legal' | 'a3' | 'a5'
export type OrientationId = 'auto' | 'portrait' | 'landscape'
export type MarginId = 'none' | 'small' | 'big'

export interface ImagesToPdfOptions {
  /** One merged PDF (true) or one PDF per image (false). */
  merge: boolean
  pageSize: PageSizeId
  orientation: OrientationId
  margin: MarginId
}

export interface ImageInput {
  name: string
  bytes: Uint8Array
  /** Clockwise, one of 0 / 90 / 180 / 270. */
  rotation: number
}

export interface ImagesToPdfResult {
  name: string
  bytes: Uint8Array
}

const PAGE_SIZES: Record<Exclude<PageSizeId, 'fit'>, [number, number]> = {
  a4: PageSizes.A4,
  letter: PageSizes.Letter,
  legal: PageSizes.Legal,
  a3: PageSizes.A3,
  a5: PageSizes.A5,
}

/** In PDF points. */
const MARGINS: Record<MarginId, number> = { none: 0, small: 18, big: 36 }

/**
 * "Fit to image" maps one image pixel to one PDF point, so an unbounded page
 * would be absurd for a modern photo (a 5120px-wide shot = a 71in page). Cap
 * the longer edge at A0's shorter side and scale the image down proportionally
 * past that — never cropped, never stretched.
 *
 * 2384pt = 33.1in keeps a 5120px image at ~155 DPI (still good print density)
 * and sits far below the PDF format's own ~14400pt (200in) per-page maximum,
 * so adding a margin can never push a page over that hard ceiling.
 */
const FIT_MAX_EDGE_PT = 2384

function isPng(bytes: Uint8Array): boolean {
  return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
}

/**
 * Embed one image, sniffing the real format from its magic bytes rather than
 * trusting the file name or MIME type. pdf-lib genuinely throws on CMYK JPEGs
 * and some exotic PNGs, so name the offending file — a bare failure part-way
 * through a batch would be untraceable.
 */
async function embedImage(doc: PDFDocument, image: ImageInput): Promise<PDFImage> {
  if (!isPng(image.bytes) && !isJpeg(image.bytes)) {
    throw new Error(`"${image.name}" isn't a JPG or PNG image.`)
  }
  try {
    return isPng(image.bytes)
      ? await doc.embedPng(image.bytes)
      : await doc.embedJpg(image.bytes)
  } catch {
    throw new Error(
      `"${image.name}" couldn't be added — it may be damaged or use an unsupported colour profile.`,
    )
  }
}

/** Add one image as a page, honouring its rotation and the layout options. */
function addImagePage(
  doc: PDFDocument,
  img: PDFImage,
  rotation: number,
  options: ImagesToPdfOptions,
): void {
  const m = MARGINS[options.margin]

  // The image's footprint as the viewer sees it, after the user's rotation.
  const swap = rotation === 90 || rotation === 270
  const effW = swap ? img.height : img.width
  const effH = swap ? img.width : img.height

  let pageW: number
  let pageH: number
  let scale: number

  if (options.pageSize === 'fit') {
    // Page hugs the image; only shrink, never enlarge (see FIT_MAX_EDGE_PT).
    scale = Math.min(1, FIT_MAX_EDGE_PT / Math.max(effW, effH))
    pageW = effW * scale + 2 * m
    pageH = effH * scale + 2 * m
  } else {
    const [sw, sh] = PAGE_SIZES[options.pageSize]
    const landscape =
      options.orientation === 'landscape' ||
      (options.orientation === 'auto' && effW > effH)
    pageW = landscape ? Math.max(sw, sh) : Math.min(sw, sh)
    pageH = landscape ? Math.min(sw, sh) : Math.max(sw, sh)
    // Contain-fit inside the margins, centred.
    scale = Math.min((pageW - 2 * m) / effW, (pageH - 2 * m) / effH)
  }

  // Where the rotated image's bounding box should land.
  const boxX = (pageW - effW * scale) / 2
  const boxY = (pageH - effH * scale) / 2

  // Draw dimensions are always the UNROTATED ones — pdf-lib rotates the drawn
  // box itself.
  const drawW = img.width * scale
  const drawH = img.height * scale

  // pdf-lib's degrees() is counter-clockwise and rotates about the draw origin,
  // so a clockwise user rotation R is drawn at -R with an origin offset chosen
  // to put the resulting bounding box at (boxX, boxY).
  let x = boxX
  let y = boxY
  if (rotation === 90) {
    y = boxY + drawW
  } else if (rotation === 180) {
    x = boxX + drawW
    y = boxY + drawH
  } else if (rotation === 270) {
    x = boxX + drawH
  }

  const page = doc.addPage([pageW, pageH])
  page.drawImage(img, { x, y, width: drawW, height: drawH, rotate: degrees(-rotation) })
}

/** Strip any image extension for building output file names. */
function imageBaseName(fileName: string): string {
  return fileName.replace(/\.(jpe?g|png)$/i, '')
}

/**
 * Convert images to PDF. Returns one result when merging (or when there's only
 * one image), otherwise one result per image for the caller to zip.
 */
export async function imagesToPdf(
  images: ImageInput[],
  options: ImagesToPdfOptions,
): Promise<ImagesToPdfResult[]> {
  if (images.length === 0) throw new Error('Add at least one image first.')

  if (options.merge) {
    const doc = await PDFDocument.create()
    for (const image of images) {
      addImagePage(doc, await embedImage(doc, image), image.rotation, options)
    }
    return [{ name: 'PDFdemo_images.pdf', bytes: await doc.save() }]
  }

  // One PDF per image. Two images can share a base name ("scan.jpg" and
  // "scan.png"), which would silently collide inside the zip — suffix repeats.
  const used = new Set<string>()
  const results: ImagesToPdfResult[] = []
  for (const image of images) {
    const doc = await PDFDocument.create()
    addImagePage(doc, await embedImage(doc, image), image.rotation, options)

    const base = imageBaseName(image.name)
    let name = `${base}.pdf`
    let n = 2
    while (used.has(name)) name = `${base}_${n++}.pdf`
    used.add(name)

    results.push({ name, bytes: await doc.save() })
  }
  return results
}
