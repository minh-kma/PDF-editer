import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import type { PageItem } from '../../../shared/state/types'
import { useStore } from '../../../shared/state/store'
import { PageThumb } from './PageThumb'
import { PageZoom } from './PageZoom'
import { RotateIcon } from '../../../shared/components/icons'

export function Workspace() {
  const { pages, sources, reorder, rotateAll, rotatePage, deletePage, getSource } = useStore()

  // The page currently shown enlarged (double-click a thumbnail), or null.
  const [zoomed, setZoomed] = useState<PageItem | null>(null)

  const sensors = useSensors(
    // A small movement threshold so tapping the rotate/delete buttons doesn't
    // accidentally start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pages.findIndex((p) => p.id === active.id)
    const newIndex = pages.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    reorder(arrayMove(pages, oldIndex, newIndex))
  }

  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-ink">
          Your pages{' '}
          <span className="text-sm font-semibold text-ink-faint">
            ({pages.length} {pages.length === 1 ? 'page' : 'pages'} from {sources.length}{' '}
            {sources.length === 1 ? 'file' : 'files'})
          </span>
        </h2>
        <div className="flex items-center gap-3">
          <p className="hidden text-sm text-ink-soft sm:block">Drag pages to reorder</p>
          <button type="button" className="btn-secondary" onClick={() => rotateAll(90)}>
            <RotateIcon width={18} height={18} />
            Rotate all
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pages.map((page, i) => (
              <PageThumb
                key={page.id}
                page={page}
                source={getSource(page.sourceId)}
                position={i + 1}
                onRotate={(id) => rotatePage(id, 90)}
                onDelete={deletePage}
                onEnlarge={setZoomed}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {zoomed && (
        <PageZoom
          page={zoomed}
          source={getSource(zoomed.sourceId)}
          position={pages.findIndex((p) => p.id === zoomed.id) + 1}
          onClose={() => setZoomed(null)}
        />
      )}
    </div>
  )
}
