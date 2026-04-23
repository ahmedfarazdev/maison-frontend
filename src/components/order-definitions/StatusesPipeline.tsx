import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { StatusCard } from './StatusCard';
import { StatusEditModal } from './StatusEditModal';
import type { DraftStatus } from './types';

interface StatusesPipelineProps {
  statuses: DraftStatus[];
  onStatusesChange: (statuses: DraftStatus[]) => void;
  onAddStatus: () => void;
  disabled?: boolean;
}

export function StatusesPipeline({
  statuses,
  onStatusesChange,
  onAddStatus,
  disabled,
}: StatusesPipelineProps) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [editingStatus, setEditingStatus] = useState<DraftStatus | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const statusItemIds = statuses.map((status, index) => status.id ?? status.clientTempId ?? `status-${index}`);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    if (!event.over) {
      return;
    }

    const activeItemId = String(event.active.id);
    const overItemId = String(event.over.id);

    if (activeItemId !== overItemId) {
      const activeIndex = statusItemIds.indexOf(activeItemId);
      const overIndex = statusItemIds.indexOf(overItemId);

      if (activeIndex !== -1 && overIndex !== -1) {
        onStatusesChange(arrayMove(statuses, activeIndex, overIndex));
      }
    }
  };

  const handleEditStatus = (index: number) => {
    setEditingIndex(index);
    setEditingStatus({ ...statuses[index] });
  };

  const handleSaveStatus = (updated: DraftStatus) => {
    if (editingIndex !== null) {
      const newStatuses = [...statuses];
      newStatuses[editingIndex] = updated;
      onStatusesChange(newStatuses);
      setEditingStatus(null);
      setEditingIndex(null);
    }
  };

  const handleDeleteStatus = (index: number) => {
    if (statuses.length > 1) {
      const newStatuses = statuses.filter((_, i) => i !== index);
      onStatusesChange(newStatuses);
    }
  };

  const draggingIndex = activeId ? statusItemIds.indexOf(String(activeId)) : -1;
  const draggingStatus = draggingIndex >= 0 ? statuses[draggingIndex] : null;

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={statusItemIds} strategy={horizontalListSortingStrategy}>
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {statuses.map((status, index) => {
              const itemId = statusItemIds[index];
              return (
                <div key={itemId} className="flex-shrink-0">
                  <StatusCard
                    itemId={itemId}
                    status={status}
                    onEdit={() => handleEditStatus(index)}
                    onDelete={() => handleDeleteStatus(index)}
                    disabled={disabled}
                  />
                </div>
              );
            })}

            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1 flex-shrink-0"
              onClick={onAddStatus}
              disabled={disabled}
              title="Add a new status"
            >
              <Plus className="w-3 h-3" /> Add Status
            </Button>
          </div>
        </SortableContext>

        <DragOverlay>
          {draggingStatus ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card/80 shadow-lg opacity-80">
              <div className="w-4 h-4" />
              <p className="text-sm font-medium">{draggingStatus.label || '(unnamed)'}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <StatusEditModal
        open={editingStatus !== null}
        status={editingStatus}
        onSave={handleSaveStatus}
        onClose={() => {
          setEditingStatus(null);
          setEditingIndex(null);
        }}
        disabled={disabled}
      />
    </div>
  );
}
