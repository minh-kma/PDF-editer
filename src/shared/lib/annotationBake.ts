// The one shared "draw a mark onto a PDF page" pipeline (decision D11).
// Watermark and page numbers are drawn here with pdf-lib; buildPdf, splitPdf
// and extractPdf all reach this via pdfCore.copyPagesToPdf, so marks are baked
// in exactly one place. Runs entirely in the browser.
import {
  degrees,
  rgb,
  StandardFonts,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import type { AssetMap, DocAnnotation } from '../state/types'

export interface BakeSession {
  out: PDFDocument
  assets: AssetMap
  font: PDFFont
  images: Map<string, PDFImage>
}

export interface PageContext {
  /** 1-based page position in the output being produced. */
  pageNumber: number
  totalPages: number
}

export async function createBakeSession(out: PDFDocument, assets: AssetMap): Promise<BakeSession> {
  // One standard font for the whole document (the marks carry a size and
  // colour, not a font family — Helvetica is the only face used).
  const font = await out.embedFont(StandardFonts.Helvetica)
  return { out, assets, font, images: new Map() }
}

// -- helpers ----------------------------------------------------------------

function hex(color: string | undefined, fallback = '#000000') {
  const c = (color ?? fallback).replace('#', '')
  const n = c.length === 3 ? c.split('').map((ch) => ch + ch).join('') : c
  const int = parseInt(n, 16)
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255)
}

async function embedAsset(session: BakeSession, assetId: string): Promise<PDFImage | null> {
  const cached = session.images.get(assetId)
  if (cached) return cached
  const asset = session.assets[assetId]
  if (!asset) return null
  const img =
    asset.mimeType === 'image/png'
      ? await session.out.embedPng(asset.bytes)
      : await session.out.embedJpg(asset.bytes)
  session.images.set(assetId, img)
  return img
}

// -- document-level annotations (watermark / page numbers) ------------------

async function drawDocAnnotation(
  session: BakeSession,
  page: PDFPage,
  d: DocAnnotation,
  W: number,
  H: number,
  ctx: PageContext,
): Promise<void> {
  if (d.range && (ctx.pageNumber < d.range.from || ctx.pageNumber > d.range.to)) return

  if (d.type === 'pageNumber') {
    const text = (d.format ?? '{n} / {total}')
      .replace('{n}', String(ctx.pageNumber))
      .replace('{total}', String(ctx.totalPages))
    const size = d.fontSize ?? 12
    const m = d.margin ?? 24
    const tw = session.font.widthOfTextAtSize(text, size)
    const corner = d.corner ?? 'br'
    const x = corner === 'tl' || corner === 'bl' ? m : W - m - tw
    const y = corner === 'tl' || corner === 'tr' ? H - m - size : m
    page.drawText(text, { x, y, size, font: session.font, color: hex(d.color, '#666666') })
    return
  }

  // watermark
  if (d.assetId) {
    const img = await embedAsset(session, d.assetId)
    if (img) {
      const w = W * 0.5
      const h = (img.height / img.width) * w
      page.drawImage(img, {
        x: (W - w) / 2,
        y: (H - h) / 2,
        width: w,
        height: h,
        opacity: d.opacity ?? 0.15,
      })
    }
    return
  }
  const size = d.fontSize ?? 48
  const text = d.text ?? ''
  const tw = session.font.widthOfTextAtSize(text, size)
  page.drawText(text, {
    x: (W - tw) / 2,
    y: H / 2,
    size,
    font: session.font,
    color: hex(d.color, '#888888'),
    opacity: d.opacity ?? 0.15,
    rotate: degrees(d.rotationDeg ?? 45),
  })
}

/** Bake every document mark (watermark / page numbers) onto one output page. */
export async function bakePage(
  session: BakeSession,
  page: PDFPage,
  docAnnotations: DocAnnotation[],
  ctx: PageContext,
): Promise<void> {
  const { width: W, height: H } = page.getSize()
  for (const d of docAnnotations) await drawDocAnnotation(session, page, d, W, H, ctx)
}
