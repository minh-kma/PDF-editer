// Reload recovery: quietly save the working session to the browser's own
// IndexedDB (via idb-keyval) so a page refresh doesn't lose in-progress work.
// This never leaves the device.
import { get, set, del } from 'idb-keyval'
import type { PageItem, SourceDoc } from '../state/types'

const SESSION_KEY = 'pdfdemo:session:v1'

export interface SavedSession {
  savedAt: number
  sources: SourceDoc[]
  pages: PageItem[]
}

export async function saveSession(sources: SourceDoc[], pages: PageItem[]): Promise<void> {
  if (sources.length === 0 || pages.length === 0) {
    await clearSession()
    return
  }
  const session: SavedSession = { savedAt: Date.now(), sources, pages }
  await set(SESSION_KEY, session)
}

export async function loadSession(): Promise<SavedSession | undefined> {
  try {
    const session = await get<SavedSession>(SESSION_KEY)
    if (!session || !session.sources?.length || !session.pages?.length) return undefined
    // idb-keyval may return bytes as ArrayBuffer after structured clone; make
    // sure they're Uint8Array again.
    session.sources = session.sources.map((s) => ({
      ...s,
      bytes: s.bytes instanceof Uint8Array ? s.bytes : new Uint8Array(s.bytes as ArrayBuffer),
    }))
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
