// The staged image list for the Images to PDF tool: ordering, per-image
// rotation, and object-URL lifecycle. Deliberately local to this module rather
// than in the app store — this is a one-shot tool with no autosave and no
// undo/redo, so none of it belongs in the page-plan state or its history.
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ImageItem {
  id: string
  /** The File itself, not its bytes — the browser backs it lazily, and
   * arrayBuffer() is only called when the user hits Create. */
  file: File
  name: string
  /** Object URL for the thumbnail; revoked on remove and on unmount. */
  url: string
  /** Clockwise, one of 0 / 90 / 180 / 270. */
  rotation: number
}

/** pdf-lib embeds PNG and JPEG only (decisions.md D4). */
export function isSupportedImage(file: File): boolean {
  return (
    file.type === 'image/jpeg' ||
    file.type === 'image/png' ||
    /\.(jpe?g|png)$/i.test(file.name)
  )
}

export function useImageList() {
  const [images, setImages] = useState<ImageItem[]>([])

  // Object URLs live outside React state so the unmount cleanup can reach them
  // without re-running whenever the list changes.
  const urls = useRef(new Set<string>())

  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url)
      urls.current.clear()
    },
    [],
  )

  const add = useCallback((files: File[]) => {
    const next = files.map((file) => {
      const url = URL.createObjectURL(file)
      urls.current.add(url)
      return { id: crypto.randomUUID(), file, name: file.name, url, rotation: 0 }
    })
    setImages((prev) => [...prev, ...next])
  }, [])

  const remove = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((i) => i.id === id)
      if (target) {
        URL.revokeObjectURL(target.url)
        urls.current.delete(target.url)
      }
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const rotate = useCallback((id: string, delta: number) => {
    setImages((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, rotation: (((i.rotation + delta) % 360) + 360) % 360 } : i,
      ),
    )
  }, [])

  const reorder = useCallback((next: ImageItem[]) => setImages(next), [])

  /** Sort by file name, numeric-aware so "img2" comes before "img10". */
  const sort = useCallback((direction: 'asc' | 'desc') => {
    setImages((prev) =>
      [...prev].sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, undefined, { numeric: true })
        return direction === 'asc' ? cmp : -cmp
      }),
    )
  }, [])

  return { images, add, remove, rotate, reorder, sort }
}
