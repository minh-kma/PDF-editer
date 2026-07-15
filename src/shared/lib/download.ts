// Helpers to hand a finished file to the browser's download mechanism.

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Give the browser a moment before revoking the temporary URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadPdf(bytes: Uint8Array, fileName: string) {
  // Copy into a fresh ArrayBuffer so the Blob owns clean, non-detached memory.
  const copy = bytes.slice()
  downloadBlob(new Blob([copy], { type: 'application/pdf' }), fileName)
}

// Minimal typing for the File System Access API (not in the standard DOM lib).
interface SaveFilePickerWindow {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: { description?: string; accept: Record<string, string[]> }[]
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: BufferSource | Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

/**
 * Save a PDF, letting the user pick the location/filename via the browser's
 * native save dialog when supported (Chromium's showSaveFilePicker), with the
 * current auto-generated name pre-filled. Falls back to a plain download (same
 * default name, browser's default folder) on browsers without the API
 * (Firefox, Safari), so downloads never break.
 */
export async function savePdf(bytes: Uint8Array, fileName: string): Promise<void> {
  const copy = bytes.slice()
  const picker = (window as unknown as SaveFilePickerWindow).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description: 'PDF file', accept: { 'application/pdf': ['.pdf'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(copy)
      await writable.close()
      return
    } catch (err) {
      // The user cancelled the dialog — respect that, don't force a download.
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Any other failure (e.g. permission): fall back to a plain download.
    }
  }
  downloadPdf(bytes, fileName)
}
