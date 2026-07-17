// Reload recovery: quietly save the working session to the browser's own
// IndexedDB (via idb-keyval) so a page refresh doesn't lose in-progress work.
// This never leaves the device.
import { get, set, del } from 'idb-keyval'
import type { Annotation, AssetMap, DocAnnotation, PageItem, SourceDoc } from '../state/types'

// v2 adds annotations/docAnnotations/assets. The key suffix is bumped so any
// incompatible v1 save is simply ignored (sessions are ephemeral — no migration).
const SESSION_KEY = 'pdfdemo:session:v2'

export interface SavedSession {
  version: 2
  savedAt: number
  sources: SourceDoc[]
  pages: PageItem[]
  annotations: Record<string, Annotation[]>
  docAnnotations: DocAnnotation[]
  assets: AssetMap
}

export async function saveSession(
  sources: SourceDoc[],
  pages: PageItem[],
  annotations: Record<string, Annotation[]>,
  docAnnotations: DocAnnotation[],
  assets: AssetMap,
): Promise<void> {
  if (sources.length === 0 || pages.length === 0) {
    await clearSession()
    return
  }
  const session: SavedSession = {
    version: 2,
    savedAt: Date.now(),
    sources,
    pages,
    annotations,
    docAnnotations,
    assets,
  }
  await set(SESSION_KEY, session)
}

/** idb-keyval's structured clone can hand back bytes as a raw ArrayBuffer. */
function asBytes(b: Uint8Array | ArrayBuffer): Uint8Array {
  return b instanceof Uint8Array ? b : new Uint8Array(b)
}

export async function loadSession(): Promise<SavedSession | undefined> {
  try {
    const session = await get<SavedSession>(SESSION_KEY)
    if (!session || !session.sources?.length || !session.pages?.length) return undefined
    // Re-wrap source bytes AND asset bytes as Uint8Array after structured clone.
    session.sources = session.sources.map((s) => ({ ...s, bytes: asBytes(s.bytes) }))
    if (session.assets) {
      for (const id of Object.keys(session.assets)) {
        const a = session.assets[id]
        session.assets[id] = { ...a, bytes: asBytes(a.bytes) }
      }
    } else {
      session.assets = {}
    }
    session.annotations ??= {}
    session.docAnnotations ??= []
    return session
  } catch {
    return undefined
  }
}

export async function clearSession(): Promise<void> {
  try {
    await del(SESSION_KEY)
  } catch {
    // Ignore — recovery is best-effort.
  }
}
