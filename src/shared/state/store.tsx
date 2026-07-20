import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { produce } from 'immer'
import type {
  AppState,
  Asset,
  AssetMap,
  DocAnnotation,
  EditSnapshot,
  PageItem,
  SourceDoc,
} from './types'

// ---------------------------------------------------------------------------
// A small, dependency-light state store: React useReducer + context, with
// immer for ergonomic immutable updates and a whole-edit-slice undo/redo
// history. See .claude/docs (Edit-group state model) for the design.
// ---------------------------------------------------------------------------

const HISTORY_LIMIT = 50

// Exported for headless/unit testing of the pure state logic.
// eslint-disable-next-line react-refresh/only-export-components
export const initialState: AppState = {
  sources: [],
  pages: [],
  docAnnotations: [],
  assets: {},
  past: [],
  future: [],
  busy: false,
  busyMessage: '',
}

type Action =
  | { type: 'ADD_SOURCE'; source: SourceDoc; pages: PageItem[] }
  | { type: 'DELETE_PAGE'; pageId: string }
  | { type: 'ROTATE_PAGE'; pageId: string; delta: number }
  | { type: 'ROTATE_ALL'; delta: number }
  | { type: 'REORDER'; pages: PageItem[] }
  | { type: 'ADD_DOC_ANNOTATION'; annotation: DocAnnotation }
  | { type: 'UPDATE_DOC_ANNOTATION'; annotation: DocAnnotation }
  | { type: 'DELETE_DOC_ANNOTATION'; id: string }
  | { type: 'ADD_ASSET'; id: string; asset: Asset }
  | { type: 'RESET' }
  | {
      type: 'RESTORE'
      sources: SourceDoc[]
      pages: PageItem[]
      docAnnotations?: DocAnnotation[]
      assets?: AssetMap
    }
  | { type: 'SET_BUSY'; busy: boolean; message?: string }
  | { type: 'UNDO' }
  | { type: 'REDO' }

// Actions that create an undo step (the whole edit slice: pages + doc marks).
// ADD_ASSET is deliberately absent — assets are append-only and referenced by
// id, so they never need to be rolled back.
const UNDOABLE = new Set<Action['type']>([
  'ADD_SOURCE',
  'DELETE_PAGE',
  'ROTATE_PAGE',
  'ROTATE_ALL',
  'REORDER',
  'ADD_DOC_ANNOTATION',
  'UPDATE_DOC_ANNOTATION',
  'DELETE_DOC_ANNOTATION',
])

function normalizeRotation(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function editSlice(s: AppState): EditSnapshot {
  // Cheap thanks to immer structural sharing: unchanged nested objects/arrays
  // keep their references, so a snapshot is just a few pointers.
  return { pages: s.pages, docAnnotations: s.docAnnotations }
}

// Core state transitions (no history bookkeeping — that's the wrapper's job).
const coreReducer = produce((draft: AppState, action: Action) => {
  switch (action.type) {
    case 'ADD_SOURCE':
      draft.sources.push(action.source)
      draft.pages.push(...action.pages)
      break
    case 'DELETE_PAGE':
      draft.pages = draft.pages.filter((p) => p.id !== action.pageId)
      // Sources are retained (undo/redo of a delete needs the bytes back);
      // orphaned sources are ignored by loadSources and cleared on RESET.
      break
    case 'ROTATE_PAGE':
      for (const p of draft.pages) {
        if (p.id === action.pageId) p.rotation = normalizeRotation(p.rotation + action.delta)
      }
      break
    case 'ROTATE_ALL':
      for (const p of draft.pages) p.rotation = normalizeRotation(p.rotation + action.delta)
      break
    case 'REORDER':
      draft.pages = action.pages
      break
    case 'ADD_DOC_ANNOTATION':
      draft.docAnnotations.push(action.annotation)
      break
    case 'UPDATE_DOC_ANNOTATION': {
      const i = draft.docAnnotations.findIndex((d) => d.id === action.annotation.id)
      if (i >= 0) draft.docAnnotations[i] = action.annotation
      break
    }
    case 'DELETE_DOC_ANNOTATION':
      draft.docAnnotations = draft.docAnnotations.filter((d) => d.id !== action.id)
      break
    case 'ADD_ASSET':
      draft.assets[action.id] = action.asset
      break
    case 'SET_BUSY':
      draft.busy = action.busy
      draft.busyMessage = action.message ?? ''
      break
    case 'RESET':
      return initialState
    case 'RESTORE':
      return {
        ...initialState,
        sources: action.sources,
        pages: action.pages,
        docAnnotations: action.docAnnotations ?? [],
        assets: action.assets ?? {},
      }
  }
}, initialState)

// History wrapper: records the pre-action edit slice for undoable actions,
// and services UNDO / REDO.
// eslint-disable-next-line react-refresh/only-export-components
export function reducer(state: AppState, action: Action): AppState {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state
    const previous = state.past[state.past.length - 1]
    return {
      ...state,
      ...previous,
      past: state.past.slice(0, -1),
      future: [editSlice(state), ...state.future],
    }
  }
  if (action.type === 'REDO') {
    if (state.future.length === 0) return state
    const next = state.future[0]
    return {
      ...state,
      ...next,
      past: [...state.past, editSlice(state)],
      future: state.future.slice(1),
    }
  }

  const nextState = coreReducer(state, action)
  if (nextState === state) return state // no-op, don't touch history

  if (UNDOABLE.has(action.type)) {
    return {
      ...nextState,
      past: [...state.past, editSlice(state)].slice(-HISTORY_LIMIT),
      future: [], // a fresh edit invalidates the redo stack
    }
  }
  return nextState
}

// Fast, dependency-free content hash (FNV-1a) for asset dedup.
function hashBytes(bytes: Uint8Array): string {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16) + ':' + bytes.length
}

interface StoreValue extends AppState {
  addSource: (source: SourceDoc) => void
  deletePage: (pageId: string) => void
  rotatePage: (pageId: string, delta: number) => void
  rotateAll: (delta: number) => void
  reorder: (pages: PageItem[]) => void
  addDocAnnotation: (annotation: DocAnnotation) => void
  updateDocAnnotation: (annotation: DocAnnotation) => void
  deleteDocAnnotation: (id: string) => void
  /** Add image bytes (deduped by content hash); returns the assetId to reference. */
  addAsset: (bytes: Uint8Array, mimeType: Asset['mimeType']) => string
  reset: () => void
  restore: (
    sources: SourceDoc[],
    pages: PageItem[],
    docAnnotations?: DocAnnotation[],
    assets?: AssetMap,
  ) => void
  setBusy: (busy: boolean, message?: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  getSource: (sourceId: string) => SourceDoc | undefined
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const addSource = useCallback((source: SourceDoc) => {
    const pages: PageItem[] = Array.from({ length: source.pageCount }, (_, i) => ({
      id: crypto.randomUUID(),
      sourceId: source.id,
      sourceIndex: i,
      rotation: 0,
    }))
    dispatch({ type: 'ADD_SOURCE', source, pages })
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      addSource,
      deletePage: (pageId) => dispatch({ type: 'DELETE_PAGE', pageId }),
      rotatePage: (pageId, delta) => dispatch({ type: 'ROTATE_PAGE', pageId, delta }),
      rotateAll: (delta) => dispatch({ type: 'ROTATE_ALL', delta }),
      reorder: (pages) => dispatch({ type: 'REORDER', pages }),
      addDocAnnotation: (annotation) => dispatch({ type: 'ADD_DOC_ANNOTATION', annotation }),
      updateDocAnnotation: (annotation) => dispatch({ type: 'UPDATE_DOC_ANNOTATION', annotation }),
      deleteDocAnnotation: (id) => dispatch({ type: 'DELETE_DOC_ANNOTATION', id }),
      addAsset: (bytes, mimeType) => {
        // Assets are keyed by their content hash, so identical images dedup
        // automatically and the assetId is stable across re-inserts.
        const hash = hashBytes(bytes)
        if (!state.assets[hash]) dispatch({ type: 'ADD_ASSET', id: hash, asset: { mimeType, bytes, hash } })
        return hash
      },
      reset: () => dispatch({ type: 'RESET' }),
      restore: (sources, pages, docAnnotations, assets) =>
        dispatch({ type: 'RESTORE', sources, pages, docAnnotations, assets }),
      setBusy: (busy, message) => dispatch({ type: 'SET_BUSY', busy, message }),
      undo: () => dispatch({ type: 'UNDO' }),
      redo: () => dispatch({ type: 'REDO' }),
      canUndo: state.past.length > 0,
      canRedo: state.future.length > 0,
      getSource: (sourceId) => state.sources.find((s) => s.id === sourceId),
    }),
    [state, addSource],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>')
  return ctx
}
