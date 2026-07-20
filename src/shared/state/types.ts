// Core data shapes for PDFdemo.
//
// The app keeps an in-memory "plan": a list of source PDF files, plus an
// ordered list of pages. Nothing is written to a real file until the user
// downloads. Merge = pages from several sources sharing one ordered list.
//
// The Edit group layers document-level marks (watermark / page numbers) on top
// of the plan; they are baked onto the output at export time.

export interface SourceDoc {
  /** Stable unique id for this uploaded file. */
  id: string
  /** Original file name, e.g. "invoice.pdf". */
  name: string
  /** The original, untouched PDF bytes. */
  bytes: Uint8Array
  /** Number of pages in the original file. */
  pageCount: number
}

export interface PageItem {
  /** Stable unique id for this page in the plan (used by drag-and-drop). */
  id: string
  /** Which source file this page came from. */
  sourceId: string
  /** 0-based page index within the source file. */
  sourceIndex: number
  /** Extra rotation the user applied, in degrees: 0, 90, 180, or 270. */
  rotation: number
}

// ---------------------------------------------------------------------------
// Document marks (watermark / page numbers)
// ---------------------------------------------------------------------------

/**
 * A rectangle in normalized coordinates: 0..1 relative to the page's UNROTATED
 * crop box, top-left origin. Conversion to pdf-lib points (bottom-left origin)
 * happens at bake/apply time and the page's own rotation is applied separately,
 * so stored coordinates are resolution- and rotation-independent. Used by the
 * logic-only Edit modules (crop, edit-text, forms) and OCR word boxes.
 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Document-level marks applied across pages (watermark, page numbers). */
export interface DocAnnotation {
  id: string
  type: 'watermark' | 'pageNumber'
  /** 1-based output page range this applies to; omitted = all pages. */
  range?: { from: number; to: number }
  // watermark
  text?: string
  assetId?: string
  fontSize?: number
  color?: string
  opacity?: number
  rotationDeg?: number
  // pageNumber — `format` supports {n} and {total} tokens
  format?: string
  corner?: 'tl' | 'tr' | 'bl' | 'br'
  /** In points. */
  margin?: number
}

/** Binary payload for an image watermark, referenced by assetId. */
export interface Asset {
  mimeType: 'image/png' | 'image/jpeg'
  bytes: Uint8Array
  /** Content hash, used to dedup identical images. */
  hash: string
}
export type AssetMap = Record<string, Asset>

/** The undoable slice of state — excludes immutable source bytes and assets. */
export interface EditSnapshot {
  pages: PageItem[]
  docAnnotations: DocAnnotation[]
}

export interface AppState {
  sources: SourceDoc[]
  pages: PageItem[]
  /** Document-wide marks (watermark / page numbers). */
  docAnnotations: DocAnnotation[]
  /** Binary assets (images) referenced by docAnnotations. */
  assets: AssetMap
  /** Undo history (most recent last). In-memory only — never persisted. */
  past: EditSnapshot[]
  /** Redo history (most recent first). */
  future: EditSnapshot[]
  /** True while a file is being read/parsed. */
  busy: boolean
  /** Human-friendly status shown during long operations. */
  busyMessage: string
}
