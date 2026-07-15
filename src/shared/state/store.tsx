import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { AppState, PageItem, SourceDoc } from './types'

// ---------------------------------------------------------------------------
// A small, dependency-free state store built on React's useReducer + context.
// Kept deliberately simple and readable so features can be added later.
// ---------------------------------------------------------------------------

const initialState: AppState = {
  sources: [],
  pages: [],
  busy: false,
  busyMessage: '',
}

type Action =
  | { type: 'ADD_SOURCE'; source: SourceDoc; pages: PageItem[] }
  | { type: 'DELETE_PAGE'; pageId: string }
  | { type: 'ROTATE_PAGE'; pageId: string; delta: number }
  | { type: 'ROTATE_ALL'; delta: number }
  | { type: 'REORDER'; pages: PageItem[] }
  | { type: 'RESET' }
  | { type: 'RESTORE'; sources: SourceDoc[]; pages: PageItem[] }
  | { type: 'SET_BUSY'; busy: boolean; message?: string }

function normalizeRotation(deg: number): number {
  return ((deg % 360) + 360) % 360
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_SOURCE':
      return {
        ...state,
        sources: [...state.sources, action.source],
        pages: [...state.pages, ...action.pages],
      }
    case 'DELETE_PAGE': {
      const pages = state.pages.filter((p) => p.id !== action.pageId)
      // Drop sources that no longer have any pages in the plan.
      const usedSourceIds = new Set(pages.map((p) => p.sourceId))
      const sources = state.sources.filter((s) => usedSourceIds.has(s.id))
      return { ...state, pages, sources }
    }
    case 'ROTATE_PAGE':
      return {
        ...state,
        pages: state.pages.map((p) =>
          p.id === action.pageId
            ? { ...p, rotation: normalizeRotation(p.rotation + action.delta) }
            : p,
        ),
      }
    case 'ROTATE_ALL':
      return {
        ...state,
        pages: state.pages.map((p) => ({
          ...p,
          rotation: normalizeRotation(p.rotation + action.delta),
        })),
      }
    case 'REORDER':
      return { ...state, pages: action.pages }
    case 'RESET':
      return { ...initialState }
    case 'RESTORE':
      return { ...initialState, sources: action.sources, pages: action.pages }
    case 'SET_BUSY':
      return { ...state, busy: action.busy, busyMessage: action.message ?? '' }
    default:
      return state
  }
}

interface StoreValue extends AppState {
  addSource: (source: SourceDoc) => void
  deletePage: (pageId: string) => void
  rotatePage: (pageId: string, delta: number) => void
  rotateAll: (delta: number) => void
  reorder: (pages: PageItem[]) => void
  reset: () => void
  restore: (sources: SourceDoc[], pages: PageItem[]) => void
  setBusy: (busy: boolean, message?: string) => void
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
      reset: () => dispatch({ type: 'RESET' }),
      restore: (sources, pages) => dispatch({ type: 'RESTORE', sources, pages }),
      setBusy: (busy, message) => dispatch({ type: 'SET_BUSY', busy, message }),
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
