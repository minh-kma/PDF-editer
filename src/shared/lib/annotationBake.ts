// The one shared "draw annotation onto a PDF page" pipeline (decision D11).
// Every Edit annotation type is drawn here with pdf-lib; buildPdf, splitPdf and
// extractPdf all reach this via pdfCore.copyPagesToPdf, so annotations are
// baked in exactly one place. Runs entirely in the browser.
import {
  degrees,
  rgb,
  StandardFonts,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib'
import type { Annotation, AssetMap, DocAnnotation, Rect } from '../state/types'

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
  // One standard font for the whole document (font-family selection is a later
  // refinement — the model carries the fields, the bake uses Helvetica for now).
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

/** normalized rect (top-left origin) -> pdf-lib rect (bottom-left origin). */
function toRect(r: Rect, W: number, H: number) {
  return { x: r.x * W, y: H - (r.y + r.h) * H, w: r.w * W, h: r.h * H }
}

/** normalized point (top-left origin) -> pdf-lib point (bottom-left origin). */
function toPt(nx: number, ny: number, W: number, H: number) {
  return { x: nx * W, y: (1 - ny) * H }
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

// -- per-page annotations ---------------------------------------------------

async function drawAnnotation(
  session: BakeSession,
  page: PDFPage,
  a: Annotation,
  W: number,
  H: number,
): Promise<void> {
  const opacity = a.opacity ?? 1
  const box = toRect(a.rect, W, H)

  switch (a.type) {
    case 'text': {
      page.drawText(a.content, {
        x: box.x,
        y: box.y + Math.max(0, box.h - a.fontSize),
        size: a.fontSize,
        font: session.font,
        color: hex(a.color),
        opacity,
        lineHeight: a.fontSize * 1.15,
        maxWidth: box.w || undefined,
      })
      break
    }
    case 'note': {
      // Sticky note: a small filled square marker at the top-left of the rect.
      const s = Math.min(box.w, box.h) || 14
      page.drawRectangle({
        x: box.x,
        y: box.y + box.h - s,
        width: s,
        height: s,
        color: hex(a.color, '#ffd54a'),
        opacity,
      })
      break
    }
    case 'highlight': {
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.w,
        height: box.h,
        color: hex(a.color, '#fff176'),
        opacity: a.opacity ?? 0.35,
      })
      break
    }
    case 'textHighlight': {
      for (const q of a.quads) {
        const r = toRect(q, W, H)
        page.drawRectangle({
          x: r.x,
          y: r.y,
          width: r.w,
          height: r.h,
          color: hex(a.color, '#fff176'),
          opacity: a.opacity ?? 0.4,
        })
      }
      break
    }
    case 'image': {
      const img = await embedAsset(session, a.assetId)
      if (img) page.drawImage(img, { x: box.x, y: box.y, width: box.w, height: box.h, opacity })
      break
    }
    case 'freehand': {
      for (const path of a.paths) {
        for (let i = 0; i + 3 < path.length; i += 2) {
          const s = toPt(path[i], path[i + 1], W, H)
          const e = toPt(path[i + 2], path[i + 3], W, H)
          page.drawLine({
            start: s,
            end: e,
            thickness: a.strokeWidth,
            color: hex(a.stroke),
            opacity,
          })
        }
      }
      break
    }
    case 'shape': {
      const stroke = hex(a.stroke)
      if (a.shape === 'box') {
        page.drawRectangle({
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          borderColor: a.fill ? undefined : stroke,
          borderWidth: a.fill ? 0 : a.strokeWidth,
          color: a.fill ? hex(a.fill) : undefined,
          opacity,
        })
      } else if (a.shape === 'circle') {
        page.drawEllipse({
          x: box.x + box.w / 2,
          y: box.y + box.h / 2,
          xScale: box.w / 2,
          yScale: box.h / 2,
          borderColor: a.fill ? undefined : stroke,
          borderWidth: a.fill ? 0 : a.strokeWidth,
          color: a.fill ? hex(a.fill) : undefined,
          opacity,
        })
      } else {
        // line / arrow
        const p = a.points ?? [a.rect.x, a.rect.y, a.rect.x + a.rect.w, a.rect.y + a.rect.h]
        const start = toPt(p[0], p[1], W, H)
        const end = toPt(p[2], p[3], W, H)
        page.drawLine({ start, end, thickness: a.strokeWidth, color: stroke, opacity })
        if (a.shape === 'arrow') {
          const angle = Math.atan2(end.y - start.y, end.x - start.x)
          const head = 8 + a.strokeWidth * 2
          for (const off of [Math.PI - 0.4, Math.PI + 0.4]) {
            page.drawLine({
              start: end,
              end: {
                x: end.x + head * Math.cos(angle + off),
                y: end.y + head * Math.sin(angle + off),
              },
              thickness: a.strokeWidth,
              color: stroke,
              opacity,
            })
          }
        }
      }
      break
    }
  }
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

/** Bake every annotation for one output page (per-page marks, then doc-level). */
export async function bakePage(
  session: BakeSession,
  page: PDFPage,
  annotations: Annotation[],
  docAnnotations: DocAnnotation[],
  ctx: PageContext,
): Promise<void> {
  const { width: W, height: H } = page.getSize()
  for (const a of annotations) await drawAnnotation(session, page, a, W, H)
  for (const d of docAnnotations) await drawDocAnnotation(session, page, d, W, H, ctx)
}
