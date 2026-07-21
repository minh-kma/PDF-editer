// The Images to PDF screen: a dashed drop area wrapping the reorderable
// thumbnail grid, an options row, and the Create PDF action. Rendered in place
// of the main content area (App.tsx) rather than as a modal panel, since it's
// the whole workspace for this tool and needs no PDF loaded.
import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
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

// Option ids only — the visible labels come from the locale files. A4/Letter/
// Legal/A3/A5 are paper-size names and read the same in both languages, but
// they still live in the locale files so the whole list stays in one place.
const SIZE_OPTIONS: PageSizeId[] = ['fit', 'a4', 'letter', 'legal', 'a3', 'a5']

const ORIENTATION_OPTIONS: OrientationId[] = ['auto', 'portrait', 'landscape']

const MARGIN_OPTIONS: MarginId[] = ['none', 'small', 'big']

const BADGES = ['free', 'online', 'unlimited', 'private'] as const

const selectClass =
  'rounded-lg border border-brand-100 bg-white px-2.5 py-1.5 text-sm font-semibold text-ink outline-none focus:border-brand-300 focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-50'

export function ImagesToPdfView({ onClose, onError, onCreated }: ImagesToPdfViewProps) {
  const { t } = useTranslation(['imagesToPdf', 'common'])
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
      onError(t('onlyJpgPng'))
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
      setBusy(true, t('creating'))

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
          title: t('readyOne'),
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
        title: t('readyMany'),
        bytes: results[0].bytes,
        fileName: results[0].name,
        info: (
          <div className="rounded-xl bg-surface-soft p-3 text-sm text-ink-soft">
            <Trans
              i18nKey="multiInfo"
              ns="imagesToPdf"
              count={results.length}
              components={[<strong className="text-ink" key="count" />]}
            />
          </div>
        ),
        downloadLabel: t('downloadZip'),
        onDownload: () => downloadBlob(blob, 'PDFChill_images.zip'),
      })
    } catch {
      // Logic-layer errors stay English as diagnostics; show a translated one.
      onError(t('failed'))
    } finally {
      setWorking(false)
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="mt-2 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {t('title')}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-ink-soft">
          {t('intro')}
        </p>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm font-semibold text-ink-soft">
          {BADGES.map((badge) => (
            <li key={badge} className="flex items-center gap-1.5">
              <CheckIcon width={15} height={15} className="text-brand-500" />
              {t(`badges.${badge}`)}
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
          dragging ? 'border-brand-400 bg-brand-100' : 'border-brand-300 bg-brand-50'
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
            <p className="text-lg font-extrabold text-ink">{t('dropTitle')}</p>
            <p className="mt-1 text-sm text-ink-soft">{t('dropSubtitle')}</p>
            <span className="btn-primary pointer-events-none mt-5">
              <UploadIcon width={18} height={18} />
              {t('chooseImages')}
            </span>
            <p className="mt-4 text-xs text-ink-faint">{t('dropFootnote')}</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-center text-sm text-ink-soft">{t('dragToReorder')}</p>
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
              title={t('sortAz')}
              aria-label={t('sortAzAria')}
              className="icon-btn rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SortAzIcon width={18} height={18} />
            </button>
            <button
              type="button"
              onClick={() => sort('desc')}
              disabled={images.length < 2}
              title={t('sortZa')}
              aria-label={t('sortZaAria')}
              className="icon-btn rounded-lg p-2 text-ink-soft hover:bg-brand-50 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SortZaIcon width={18} height={18} />
            </button>
          </div>
          <button type="button" className="btn-secondary" onClick={() => fileInput.current?.click()}>
            <PlusIcon width={18} height={18} />
            {t('addMore')}
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
          {t('mergeIntoOne')}
        </label>

        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          {t('pageSize')}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(e.target.value as PageSizeId)}
            className={selectClass}
          >
            {SIZE_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {t(`sizes.${id}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          {t('orientation')}
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as OrientationId)}
            // Meaningless when the page is cut to the image's own shape.
            disabled={pageSize === 'fit'}
            title={pageSize === 'fit' ? t('orientationFitTitle') : undefined}
            className={selectClass}
          >
            {ORIENTATION_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {t(`orientations.${id}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-ink-soft">
          {t('margin')}
          <select
            value={margin}
            onChange={(e) => setMargin(e.target.value as MarginId)}
            className={selectClass}
          >
            {MARGIN_OPTIONS.map((id) => (
              <option key={id} value={id}>
                {t(`margins.${id}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('common:cancel')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={handleCreate}
          disabled={images.length === 0 || working}
        >
          <ImageIcon width={18} height={18} />
          {t('create')}
        </button>
      </div>

      {zoomed && <ImageZoom image={zoomed} onClose={() => setZoomed(null)} />}
    </div>
  )
}
