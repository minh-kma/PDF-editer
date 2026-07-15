/** Turn a byte count into a friendly string like "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

/** Strip a trailing ".pdf" (case-insensitive) for building new file names. */
export function baseName(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '')
}
