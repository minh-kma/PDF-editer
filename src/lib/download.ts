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
