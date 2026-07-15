// Core data shapes for PDFdemo.
//
// The app keeps an in-memory "plan": a list of source PDF files, plus an
// ordered list of pages. Nothing is written to a real file until the user
// downloads. Merge = pages from several sources sharing one ordered list.

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

export interface AppState {
  sources: SourceDoc[]
  pages: PageItem[]
  /** True while a file is being read/parsed. */
  busy: boolean
  /** Human-friendly status shown during long operations. */
  busyMessage: string
}
