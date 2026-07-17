// Core data shapes for PDFdemo.
//
// The app keeps an in-memory "plan": a list of source PDF files, plus an
// ordered list of pages. Nothing is written to a real file until the user
// downloads. Merge = pages from several sources sharing one ordered list.
//
// The Edit group layers "annotations" on top of the plan: one generic shape
// (a discriminated union) covers every annotation tool. Annotations are kept
// per page (keyed by PageItem.id) and baked onto the output at export time.

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
  /** Stable unique id for this page in the plan (used by drag-and-drop and to key annotations). */
  id: string
  /** Which source file this page came from. */
  sourceId: string
  /** 0-based page index within the source file. */
  sourceIndex: number
  /** Extra rotation the user applied, in degrees: 0, 90, 180, or 270. */
  rotation: number
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

/**
 * A rectangle in normalized coordinates: 0..1 relative to the page's UNROTATED
 * crop box, top-left origin (the authoring-canvas convention). The bake step
 * converts to pdf-lib points (bottom-left origin) and the page's own rotation
 * is applied separately, so stored coordinates are resolution- and
 * rotation-independent.
 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type AnnotationType =
  | 'text'
  | 'freehand'
  | 'shape'
  | 'highlight'
  | 'textHighlight'
  | 'image'
  | 'note'

interface AnnotationBase {
  /** Stable id — for selection, update, delete, and undo. */
  id: string
  /** Bounding box (normalized). Paint order = array index. */
  rect: Rect
  /** The annotation's own rotation, in degrees (independent of the page). */
  rotation?: number
  /** 0..1. */
  opacity?: number
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text'
  content: string
  /** Typographic size, in PDF points (position is normalized, size is absolute). */
  fontSize: number
  /** Hex colour, e.g. "#1a1a1a". */
  color: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  italic?: boolean
}

export interface FreehandAnnotation extends AnnotationBase {
  type: 'freehand'
  /** One entry per stroke: a flat [x0,y0,x1,y1,…] list of normalized points. */
  paths: number[][]
  stroke: string
  /** In points. */
  strokeWidth: number
}

export interface ShapeAnnotation extends AnnotationBase {
  type: 'shape'
  shape: 'line' | 'arrow' | 'box' | 'circle'
  stroke: string
  strokeWidth: number
  /** Fill colour. The Eraser tool is a box with fill "#ffffff" and no stroke. */
  fill?: string
  /** [x0,y0,x1,y1] normalized endpoints, for line / arrow. */
  points?: number[]
}

export interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight'
  color: string
}

export interface TextHighlightAnnotation extends AnnotationBase {
  type: 'textHighlight'
  color: string
  /** Per text-run rectangles (normalized) from the pdf.js text layer. */
  quads: Rect[]
}

export interface ImageAnnotation extends AnnotationBase {
  type: 'image'
  /** References AssetMap; keeps the annotation (and undo snapshots) tiny. */
  assetId: string
}

export interface NoteAnnotation extends AnnotationBase {
  type: 'note'
  content: string
  color: string
}

/** One generic annotation shape — a discriminated union over every Edit tool. */
export type Annotation =
  | TextAnnotation
  | FreehandAnnotation
  | ShapeAnnotation
  | HighlightAnnotation
  | TextHighlightAnnotation
  | ImageAnnotation
  | NoteAnnotation

/**
 * Document-level marks applied across pages (watermark, page numbers) — kept
 * separate so they aren't copied onto every page's annotation list.
 */
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

/** Binary payload for image/signature annotations, referenced by assetId. */
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
  annotations: Record<string, Annotation[]>
  docAnnotations: DocAnnotation[]
}

export interface AppState {
  sources: SourceDoc[]
  pages: PageItem[]
  /** Per-page annotations, keyed by PageItem.id. */
  annotations: Record<string, Annotation[]>
  /** Document-wide marks (watermark / page numbers). */
  docAnnotations: DocAnnotation[]
  /** Binary assets (images/signatures) referenced by annotations. */
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
