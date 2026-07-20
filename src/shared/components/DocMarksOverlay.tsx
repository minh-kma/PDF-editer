// On-screen composite of the document-level marks (watermark / page numbers)
// over an already-rendered page image, so the workspace shows what downloading
// will produce without re-baking a PDF on every keystroke.
//
// This is a CSS approximation of shared/lib/annotationBake.ts (D11 — the bake
// stays the single source of truth for real output); the geometry here mirrors
// that file, the same way the doc-marks panels' "Preview (page 1)" does.
//
// Usage: drop it inside a `position: relative` box that wraps the page image.
// The overlay letterboxes itself to the page's aspect ratio, so it lines up
// whether the image fills its box (main view) or is object-contain'd inside a
// fixed-aspect one (sidebar thumbnails).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { getPageSizePt } from '../lib/pdfjs'
import type { AssetMap, DocAnnotation, PageItem, SourceDoc } from '../state/types'

interface DocMarksOverlayProps {
  page: PageItem
  source: SourceDoc | undefined
  /** 1-based position in the page plan — what {n} resolves to. */
  pageNumber: number
  totalPages: number
}

// Object URLs for image watermarks, shared by every page showing the same
// asset. assetId is the image's content hash, so this is naturally deduped and
// stays small (one entry per distinct watermark image).
const assetUrlCache = new Map<string, string>()

function assetUrl(assets: AssetMap, id: string): string | null {
  const cached = assetUrlCache.get(id)
  if (cached) return cached
  const asset = assets[id]
  if (!asset) return null
  const url = URL.createObjectURL(new Blob([asset.bytes.slice()], { type: asset.mimeType }))
  assetUrlCache.set(id, url)
  return url
}

export function DocMarksOverlay({ page, source, pageNumber, totalPages }: DocMarksOverlayProps) {
  const { docAnnotations, assets } = useStore()
  const boxRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const [sizePt, setSizePt] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!source) return
    getPageSizePt(source.id, source.bytes, page.sourceIndex)
      .then((s) => !cancelled && setSizePt(s))
      .catch(() => !cancelled && setSizePt(null))
    return () => {
      cancelled = true
    }
  }, [source, page.sourceIndex])

  // The overlay's own pixel size drives every pt→px conversion, so it has to
  // follow zoom / layout changes rather than be measured once.
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Page size AS DISPLAYED (w/h swapped for 90°/270°), matching how the
  // rendered image looks — same rule the panels' preview uses.
  const displayedPt =
    sizePt && page.rotation % 180 !== 0
      ? { width: sizePt.height, height: sizePt.width }
      : sizePt

  // Where the page actually sits inside this box once object-contain letter-
  // boxing is accounted for, plus the px-per-pt scale for that fit.
  const fit = useMemo(() => {
    if (!displayedPt || box.width === 0 || box.height === 0) return null
    const scale = Math.min(box.width / displayedPt.width, box.height / displayedPt.height)
    const width = displayedPt.width * scale
    const height = displayedPt.height * scale
    return {
      scale,
      width,
      height,
      left: (box.width - width) / 2,
      top: (box.height - height) / 2,
    }
  }, [displayedPt, box.width, box.height])

  const marks = docAnnotations.filter(
    (d) => !d.range || (pageNumber >= d.range.from && pageNumber <= d.range.to),
  )

  return (
    <div ref={boxRef} aria-hidden className="pointer-events-none absolute inset-0">
      {fit &&
        marks.map((d) => (
          <div
            key={d.id}
            style={{
              position: 'absolute',
              left: fit.left,
              top: fit.top,
              width: fit.width,
              height: fit.height,
              overflow: 'hidden',
            }}
          >
            <Mark
              d={d}
              scale={fit.scale}
              pageRotation={page.rotation}
              pageNumber={pageNumber}
              totalPages={totalPages}
              assets={assets}
            />
          </div>
        ))}
    </div>
  )
}

interface MarkProps {
  d: DocAnnotation
  scale: number
  pageRotation: number
  pageNumber: number
  totalPages: number
  assets: AssetMap
}

function Mark({ d, scale, pageRotation, pageNumber, totalPages, assets }: MarkProps) {
  if (d.type === 'pageNumber') {
    // Bake: x = margin from the chosen side, y = margin from the chosen edge.
    const corner = d.corner ?? 'br'
    const marginPx = (d.margin ?? 24) * scale
    const text = (d.format ?? '{n} / {total}')
      .replace('{n}', String(pageNumber))
      .replace('{total}', String(totalPages))
    return (
      <span
        style={{
          position: 'absolute',
          ...(corner === 'tl' || corner === 'bl' ? { left: marginPx } : { right: marginPx }),
          ...(corner === 'tl' || corner === 'tr' ? { top: marginPx } : { bottom: marginPx }),
          fontSize: (d.fontSize ?? 12) * scale,
          fontFamily: 'Helvetica, Arial, sans-serif',
          color: d.color ?? '#666666',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    )
  }

  // Watermark, image variant — bake centres it at half the page width.
  if (d.assetId) {
    const url = assetUrl(assets, d.assetId)
    if (!url) return null
    return (
      <img
        src={url}
        alt=""
        style={{
          position: 'absolute',
          left: '25%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '50%',
          opacity: d.opacity ?? 0.15,
        }}
      />
    )
  }

  // Watermark, text variant — bake starts the baseline at ((W-tw)/2, H/2) and
  // rotates about that point; the page's own rotation adds on top.
  const text = (d.text ?? '').trim()
  if (!text) return null
  return (
    <span
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -100%) rotate(${pageRotation - (d.rotationDeg ?? 45)}deg)`,
        transformOrigin: 'left bottom',
        fontSize: (d.fontSize ?? 48) * scale,
        fontFamily: 'Helvetica, Arial, sans-serif',
        color: d.color ?? '#888888',
        opacity: d.opacity ?? 0.15,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  )
}
