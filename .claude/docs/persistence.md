# Persistence & Reload Recovery

The only persistence in PDFdemo is a best-effort session autosave to the
browser's IndexedDB, so a page refresh doesn't lose in-progress work. Nothing
ever leaves the device. There is no server, no accounts, no cloud sync.

## Storage layer — `src/shared/lib/storage.ts`

- Backed by **idb-keyval** (single key/value pair, no custom DB schema).
- Key: `pdfdemo:session:v2`. Bump the suffix if `SavedSession`'s shape ever
  changes incompatibly — old saves under the previous key are then simply
  ignored (sessions are ephemeral, so there's no migration). `v2` added the
  Edit-group annotation fields to `v1`.
- Value shape:

```ts
interface SavedSession {
  version: 2
  savedAt: number                               // Date.now() at save time
  sources: SourceDoc[]                          // includes full original PDF bytes
  pages: PageItem[]                             // the ordered page plan
  annotations: Record<string, Annotation[]>     // per-page, keyed by PageItem.id
  docAnnotations: DocAnnotation[]               // watermark / page numbers
  assets: AssetMap                              // image/signature bytes, by content hash
}
```

- `saveSession()` clears the session instead of saving when there are no
  sources/pages (empty state = nothing to recover).
- `loadSession()` returns `undefined` on any error or empty/invalid data —
  recovery is best-effort, it must never crash the app.
- **Undo/redo history is NOT persisted** — `past`/`future` are in-memory only.
- **Restore quirk:** IndexedDB's structured clone can return `bytes` as a raw
  `ArrayBuffer` instead of `Uint8Array`; `loadSession()` re-wraps them — for
  **both** `sources[].bytes` and `assets[].bytes`. Keep this normalization if
  you touch the load path.

## Autosave flow — `src/App.tsx`

Two `useEffect`s:

1. **On first load:** `loadSession()` → if a session exists, set `recover`
   state, which renders `RecoverBanner` (shared component) offering
   Restore / Dismiss.
2. **On every `sources`/`pages`/`annotations`/`docAnnotations`/`assets`
   change:** debounce 800ms, then `saveSession()`. Guard: **saving is skipped
   while the recover banner is showing** — otherwise the current (empty) state
   would overwrite the saved session before the user chooses.

User actions:

- **Restore** → `store.restore(sources, pages, annotations, docAnnotations,
  assets)` re-populates the store (and resets undo history).
- **Dismiss** → `clearSession()`; the offer never returns for that session.
- **Start over** (toolbar) → `store.reset()` + `clearSession()`.

All `clearSession()` calls swallow errors (`.catch(() => {})`) intentionally.

## Constraints

- Full PDF bytes are stored, so sessions can be large. IndexedDB handles this;
  do **not** move to localStorage (string-only, ~5MB cap).
- Autosave must stay silent and non-blocking — no spinners, no error toasts
  for save failures.
- Any new persisted data must follow the same rules: local-only, versioned
  key, fail-soft on read.
