// The Images to PDF screen: a dashed drop area wrapping the reorderable
// thumbnail grid, an options row, and the Create PDF action. Rendered in place
// of the main content area (App.tsx) rather than as a modal panel, since it's
// the whole workspace for this tool and needs no PDF loaded.
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import JSZip from 'jszip'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable'
import { useStore } from '../../../shared/state/store'
import { downloadBlob } from '../../../shared/lib/download'
import { ImageCard } from './ImageCard'
import { ImageZoom } from './ImageZoom'
import { useImageList, isSupportedImage, type ImageItem } from './useImageList'
import {
  imagesToPdf,
  type MarginId,
  type OrientationId,
  type PageSizeId,
} from './imagesToPdf'
import {
  UploadIcon,
  PlusIcon,
  CheckIcon,
  ImageIcon,
  SortAzIcon,
  SortZaIcon,
} from '../../../shared/components/icons'

interface ImagesToPdfViewProps {
  onClose: () => void
  onError: (message: string) => void
  /** Hands the finished result to App.tsx's preview modal — never downloads
   * directly (CLAUDE.md: always preview first). */
  onCreated: (preview: {
    title: string
    bytes: Uint8Array
    fileName: string
    info?: ReactNode
    onDownload?: () => void
    downloadLabel?: string
  }) => void
}

const SIZE_OPTIONS: { id: PageSizeId; label: string }[] = [
  { id: 'fit', label: 'Fit to image' },
  { id: 'a4', label: 'A4' },
  { id: 'letter', label: 'Letter' },
  { id: 'legal', label: 'Legal' },
  { id: 'a3', label: 'A3' },
  { id: 'a5', label: 'A5' },
]

const ORIENTATION_OPTIONS: { id: OrientationId; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
]

const MARGIN_OPTIONS: { id: MarginId; label: string }[] = [
  { id: 'none', label: 'No margin' },
  { id: 'small', label: 'Small margin' },
  { id: 'big', label: 'Big margin' },
]

const BADGES = ['Free', 'Online', 'Unlimited', 'Private']

const selectClass =
  'rounded-lg border border-brand-100 bg-white px-2.5 py-1.5 text-sm font-semibold text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-50'

export function ImagesToPdfView({ onClose, onError, onCreated }: ImagesToPdfViewProps) {
  const { setBusy } = useStore()
  const { images, add, remove, rotate, reorder, sort } = useImageList()

  const [merge, setMerge] = useState(true)
  const [pageSize, setPageSize] = useState<PageSizeId>('a4')
  const [orientation, setOrientation] = useState<OrientationId>('auto')
  const [margin, setMargin] = useState<MarginId>('none')

  const [zoomed, setZoomed] = useState<ImageItem | null>(null)
  const [dragging, setDragging] = useState(false)
  const [working, setWorking] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    // A small threshold so tapping a card's toolbar doesn't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = images.findIndex((i) => i.id === active.id)
    const newIndex = images.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorder(arrayMove(images, oldIndex, newIndex))
  }

  function acceptFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    const supported = files.filter(isSupportedImage)
    if (supported.length < files.length) {
      onError('Only JPG and PNG images can be added.')
    }
    if (supported.length) add(supported)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    acceptFiles(e.dataTransfer.files)
  }

  async function handleCreate() {
    if (images.length === 0) return
    try {
      setWorking(true)
      setBusy(true, 'Creating your PDF…')

      const inputs = await Promise.all(
        images.map(async (image) => ({
          name: image.name,
          bytes: new Uint8Array(await image.file.arrayBuffer()),
          rotation: image.rotation,
        })),
      )
      const results = await imagesToPdf(inputs, { merge, pageSize, orientation, margin })

      if (results.length === 1) {
        onCreated({
          title: 'Your PDF is ready',
          bytes: results[0].bytes,
          fileName: results[0].name,
        })
        return
      }

      // One PDF per image: preview the first, download them all as one .zip.
      const zip = new JSZip()
      for (const result of results) zip.file(result.name, result.bytes)
      const blob = await zip.generateAsync({ type: 'blob' })

      onCreated({
        title: 'Your PDFs are ready',
        bytes: results[0].bytes,
        fileName: results[0].name,
        info: (
          <div className="rounded-xl bg-cream-soft p-3 text-sm text-ink-soft">
            Showing the first of{' '}
            <strong className="text-ink">{results.length} PDFs</strong> — one per image. They
            download together as a single .zip.
          </div>
        ),
        downloadLabel: 'Download .zip',
        onDownload: () => downloadBlob(blob, 'PDFdemo_images.zip'),
      })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not create the PDF.')
    } finally {
      setWorking(false)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="mt-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Images to PDF
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-ink-soft">
          Turn your JPG and PNG images into a PDF — reorder them, rotate them, and pick the page
          size. Your images never leave your device.
        </p>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-semibold text-ink-soft">
          {BADGES.map((badge) => (
            <li key={badge} className="flex items-center gap-1.5">
              <CheckIcon width={15} height={15} className="text-brand-500" />
              {badge}
            </li>
          ))}
        </ul>
      </div>

      {/* Drop area — wraps the grid and its controls, as in the reference. */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${
          dragging ? 'border-brand-400 bg-brand-50' : 'border-brand-200 bg-cream-soft'
        }`}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={(e) => {
            acceptFiles(e.target.files)
            e.target.value = '' // allow re-picking the same file
          }}
        />

        {images.length === 0 ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) =>
              (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()
            }
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl px-6 py-14 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-brand-500">
              <UploadIcon width={30} height={30} />
            </div>
            <p className="text-lg font-extrabold text-ink">Drop images here</p>
            <p className="mt-1 text-sm text-ink-soft">or click to browse your device</p>
            <span className="btn-primary pointer-events-none mt-5">
              <UploadIcon width={18} height={18} />
              Choose images
            </span>
            <p className="mt-4 text-xs text-ink-faint">
              JPG and PNG. Everything stays on your device.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-center text-sm text-ink-soft">
              Drag the cards to change the order
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {images.map((image, i) => (
                    <ImageCard
                      key={image.id}
                      image={image}
                      position={i + 1}
                      onRotate={rotate}
                      onEnlarge={setZoomed}
                      onRemove={remove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => sort('asc')}
              disabled={images.length < 2}
              title="Sort by name, A to Z"
              aria-label="Sort images by name, A to Z"
              className="icon-btn rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SortAzIcon width={18} height={18} />
            </button>
            <button
              type="button"
              onClick={() => sort('desc')}
              disabled={images.length < 2}
              title="Sort by name, Z to A"
              aria-label="Sort images by name, Z to A"
              className="icon-btn rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SortZaIcon width={18} height={18} />
            </button>
          </div>
          <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
            <PlusIcon width={18} height={18} />
            Add more images
          </button>
        </div>
      </div>

      {/* Options */}
      <div className="card flex flex-wrap items-center justify-center gap-x-6 gap-y-3 p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={merge}
            onChange={(e) => setMerge(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-brand-500"
          />
          Merge into one PDF
        </label>

        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          Page size
          <select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as PageSizeId)}
            className={selectClass}
          >
            {SIZE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          Orientation
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as OrientationId)}
            // Meaningless when the page is cut to the image's own shape.
            disabled={pageSize === 'fit'}
            title={pageSize === 'fit' ? 'The page follows each image when "Fit to image" is on' : undefined}
            className={selectClass}
          >
            {ORIENTATION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          Margin
          <select
            value={margin}
            onChange={(e) => setMargin(e.target.value as MarginId)}
            className={selectClass}
          >
            {MARGIN_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleCreate}
          disabled={images.length === 0 || working}
        >
          <ImageIcon width={18} height={18} />
          Create PDF
        </button>
      </div>

      {zoomed && <ImageZoom image={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  )
}
