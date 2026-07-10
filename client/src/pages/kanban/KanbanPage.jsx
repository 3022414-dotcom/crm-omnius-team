import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { Link } from 'react-router-dom'
import { getKanbanDeals, moveDealStage } from '../../api/deals'
import { formatAmount } from '../../lib/date'
import { cn } from '../../lib/utils'

const STAGES = [
  { id: 'lead', label: 'Lead' },
  { id: 'qualifying', label: 'Qualifying' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'closing', label: 'Closing' },
  { id: 'contract', label: 'Contract' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]

function DealCard({ deal, isDragging }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id })
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
      className="rounded-md border border-border bg-card p-3 shadow-sm cursor-grab active:cursor-grabbing space-y-1 touch-none"
    >
      <Link
        to={`/deals/${deal.id}`}
        onClick={(e) => e.stopPropagation()}
        className="text-sm font-medium hover:text-primary transition-colors block"
      >
        {deal.title}
      </Link>
      {deal.account?.name && <p className="text-xs text-muted-foreground truncate">{deal.account.name}</p>}
      {deal.value != null && <p className="text-xs text-muted-foreground">{formatAmount(deal.value)}</p>}
      {deal.owner?.name && <p className="text-xs text-muted-foreground/70 truncate">{deal.owner.name}</p>}
      {deal.expected_start_date && <p className="text-xs text-muted-foreground/70">{new Date(deal.expected_start_date).toLocaleDateString('ru-RU')}</p>}
    </div>
  )
}

function KanbanColumn({ stageId, label, deals, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: stageId })
  return (
    <div className={cn('flex-shrink-0 w-52 rounded-lg border border-border bg-muted/20 flex flex-col', isOver && 'ring-2 ring-primary')}>
      <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium">{label}</h3>
        <span className="text-xs text-muted-foreground">{deals.length}</span>
      </div>
      <div ref={setNodeRef} className="flex-1 p-2 space-y-2 min-h-16">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} isDragging={activeId === deal.id} />
        ))}
      </div>
    </div>
  )
}

export default function KanbanPage() {
  const qc = useQueryClient()
  const [activeId, setActiveId] = useState(null)

  const { data: board = {}, isLoading } = useQuery({
    queryKey: ['kanban'],
    queryFn: getKanbanDeals,
  })

  const moveMut = useMutation({
    mutationFn: ({ id, stage }) => moveDealStage(id, stage),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kanban'] }),
    onError: () => toast.error('Не удалось переместить сделку'),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const findStageForDeal = (id) => {
    for (const [stage, deals] of Object.entries(board)) {
      if (deals.some((d) => d.id === id)) return stage
    }
    return null
  }

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const fromStage = findStageForDeal(active.id)
    const toStage = over.id
    if (!fromStage || !toStage || fromStage === toStage) return
    if (!STAGES.some((s) => s.id === toStage)) return
    moveMut.mutate({ id: active.id, stage: toStage })
  }

  const activeDeal = activeId ? Object.values(board).flat().find((d) => d.id === activeId) : null

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Загрузка...</div>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Канбан</h1>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(({ id: stageId, label }) => (
            <KanbanColumn
              key={stageId}
              stageId={stageId}
              label={label}
              deals={board[stageId] ?? []}
              activeId={activeId}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDeal && (
            <div className="rounded-md border border-border bg-card p-3 shadow-xl space-y-1 w-52 opacity-90">
              <p className="text-sm font-medium">{activeDeal.title}</p>
              {activeDeal.account?.name && <p className="text-xs text-muted-foreground">{activeDeal.account.name}</p>}
              {activeDeal.owner?.name && <p className="text-xs text-muted-foreground/70">{activeDeal.owner.name}</p>}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
