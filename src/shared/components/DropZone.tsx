import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { UploadIcon, PlusIcon } from './icons'

interface DropZoneProps {
  onFiles: (files: File[]) => void
  variant?: 'hero' | 'compact'
  disabled?: boolean
}

function onlyPdfs(list: FileList | null): File[] {
  if (!list) return []
  return Array.from(list).filter(
    (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  )
}

export function DropZone({ onFiles, variant = 'hero', disabled }: DropZoneProps) {
  const { t } = useTranslation('landing')
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const files = onlyPdfs(e.dataTransfer.files)
    if (files.length) onFiles(files)
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click()
  }

  const hidden = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf,.pdf"
      multiple
      className="hidden"
      onChange={(e) => {
        const files = onlyPdfs(e.target.files)
        if (files.length) onFiles(files)
        e.target.value = '' // allow re-selecting the same file
      }}
    />
  )

  if (variant === 'compact') {
    return (
      <>
        {hidden}
        <button
          type="button"
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          disabled={disabled}
          className={`btn-secondary ${dragging ? 'ring-2 ring-brand-300' : ''}`}
        >
          <PlusIcon width={18} height={18} />
          {t('addMorePdfs')}
        </button>
      </>
    )
  }

  return (
    <div className="card p-6 sm:p-8">
      {hidden}
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          dragging
            ? 'border-brand-400 bg-brand-50'
            : 'border-brand-300 bg-brand-100 hover:border-brand-400 hover:bg-brand-200'
        }`}
      >
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-200 text-brand-600">
          <UploadIcon width={30} height={30} />
        </div>
        <p className="text-lg font-extrabold text-ink">{t('dropTitle')}</p>
        <p className="mt-1 text-sm text-ink-soft">{t('dropSubtitle')}</p>
        <span className="mt-5 btn-primary pointer-events-none">
          <UploadIcon width={18} height={18} />
          {t('choosePdfFiles')}
        </span>
        <p className="mt-4 text-xs text-ink-faint">{t('dropFootnote')}</p>
      </div>
    </div>
  )
}
