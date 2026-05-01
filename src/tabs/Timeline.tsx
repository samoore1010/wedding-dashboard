import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, ArrowDownAZ } from 'lucide-react';
import { useShallowStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EditableText } from '../components/ui/EditableText';
import { Select } from '../components/ui/Field';
import { IconButton } from '../components/ui/IconButton';
import { confirmAction } from '../components/ui/ConfirmDialog';
import type { RunOfShowItem } from '../types';

export function Timeline() {
  const {
    runOfShow,
    addROS,
    updateROS,
    removeROS,
    reorderROS,
    sortROSByTime,
    weekend,
    addWeekend,
    updateWeekend,
    removeWeekend,
  } = useShallowStore((s) => ({
    runOfShow: s.runOfShow,
    addROS: s.addROS,
    updateROS: s.updateROS,
    removeROS: s.removeROS,
    reorderROS: s.reorderROS,
    sortROSByTime: s.sortROSByTime,
    weekend: s.weekend,
    addWeekend: s.addWeekend,
    updateWeekend: s.updateWeekend,
    removeWeekend: s.removeWeekend,
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = runOfShow.findIndex((r) => r.id === active.id);
    const newIdx = runOfShow.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(runOfShow, oldIdx, newIdx);
    reorderROS(reordered.map((r) => r.id));
  };

  return (
    <div className="space-y-5">
      <Card
        title="Run of Show — Wedding Day"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowDownAZ size={14} />}
              onClick={sortROSByTime}
            >
              Sort by time
            </Button>
            <Button icon={<Plus size={14} />} size="sm" onClick={addROS}>
              Add Event
            </Button>
          </div>
        }
      >
        <p className="text-xs text-muted mb-4">
          Drag events to reorder, or click Sort by time to auto-arrange.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={runOfShow.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <ol className="relative pl-8 space-y-2 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {runOfShow.map((r) => (
                <SortableROSItem
                  key={r.id}
                  item={r}
                  onUpdate={(patch) => updateROS(r.id, patch)}
                  onDelete={async () => {
                    if (
                      await confirmAction({
                        title: 'Delete event?',
                        message: `Remove "${r.event}" from the timeline?`,
                        confirmLabel: 'Delete',
                        variant: 'danger',
                      })
                    ) {
                      removeROS(r.id);
                    }
                  }}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </Card>

      <Card
        title="Weekend Schedule"
        action={
          <Button icon={<Plus size={14} />} size="sm" onClick={addWeekend}>
            Add Event
          </Button>
        }
      >
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="px-2 py-2 w-32">Day</th>
                <th className="px-2 py-2">Event</th>
                <th className="px-2 py-2 w-32">Time</th>
                <th className="px-2 py-2">Notes</th>
                <th className="px-2 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {weekend.map((w) => (
                <tr key={w.id} className="hover:bg-bg/40">
                  <td className="px-2 py-1.5">
                    <Select
                      value={w.day}
                      onChange={(e) => updateWeekend(w.id, { day: e.target.value })}
                    >
                      {['Thursday', 'Friday', 'Saturday', 'Sunday', 'Monday'].map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableText
                      value={w.event}
                      onChange={(v) => updateWeekend(w.id, { event: v })}
                      placeholder="Event"
                      className="font-medium"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableText
                      value={w.time}
                      onChange={(v) => updateWeekend(w.id, { time: v })}
                      placeholder="Time"
                      className="text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <EditableText
                      value={w.notes}
                      onChange={(v) => updateWeekend(w.id, { notes: v })}
                      placeholder="—"
                      className="text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <IconButton
                      tone="danger"
                      onClick={async () => {
                        if (
                          await confirmAction({
                            title: 'Delete event?',
                            message: `Remove "${w.event}"?`,
                            confirmLabel: 'Delete',
                            variant: 'danger',
                          })
                        ) {
                          removeWeekend(w.id);
                        }
                      }}
                      aria-label="Delete weekend event"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SortableROSItem({
  item,
  onUpdate,
  onDelete,
}: {
  item: RunOfShowItem;
  onUpdate: (patch: Partial<RunOfShowItem>) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className="relative bg-surface border border-border rounded-lg p-3 hover:shadow-soft transition-shadow"
    >
      <span className="absolute -left-[22px] top-4 h-3 w-3 rounded-full bg-accent ring-2 ring-surface ring-offset-2 ring-offset-accent" />
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="text-muted hover:text-ink cursor-grab active:cursor-grabbing pt-1"
          aria-label="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-x-3 gap-y-1">
          <EditableText
            value={item.time}
            onChange={(v) => onUpdate({ time: v })}
            placeholder="Time"
            className="text-xs font-bold text-accent"
          />
          <EditableText
            value={item.event}
            onChange={(v) => onUpdate({ event: v })}
            placeholder="Event"
            className="text-sm font-medium"
          />
          <span />
          <EditableText
            value={item.detail}
            onChange={(v) => onUpdate({ detail: v })}
            placeholder="Details (optional)"
            className="text-xs text-muted"
          />
        </div>
        <IconButton tone="danger" onClick={onDelete} aria-label="Remove event">
          <Trash2 size={14} />
        </IconButton>
      </div>
    </li>
  );
}
