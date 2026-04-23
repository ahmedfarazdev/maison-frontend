import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TransitionRow } from './TransitionRow';
import { TransitionEditModal } from './TransitionEditModal';
import type { DraftTransition, DraftStatus } from './types';

interface TransitionsPanelProps {
  transitions: DraftTransition[];
  statuses: DraftStatus[];
  onTransitionsChange: (transitions: DraftTransition[]) => void;
  disabled?: boolean;
}

export function TransitionsPanel({
  transitions,
  statuses,
  onTransitionsChange,
  disabled,
}: TransitionsPanelProps) {
  const [editingTransition, setEditingTransition] = useState<DraftTransition | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const availableStatusCodes = useMemo(
    () => statuses.map((s) => s.statusCode.trim()).filter(Boolean),
    [statuses]
  );

  const handleEditTransition = (index: number) => {
    setEditingIndex(index);
    setEditingTransition({ ...transitions[index] });
  };

  const handleSaveTransition = (updated: DraftTransition) => {
    if (editingIndex !== null) {
      const newTransitions = [...transitions];
      newTransitions[editingIndex] = updated;
      onTransitionsChange(newTransitions);
      setEditingTransition(null);
      setEditingIndex(null);
    }
  };

  const handleAddTransition = () => {
    const newTransition: DraftTransition = {
      fromStatusCode: '',
      toStatusCode: '',
      condition: '',
      active: true,
    };
    setEditingIndex(transitions.length);
    setEditingTransition(newTransition);
  };

  const handleCreateTransition = (transition: DraftTransition) => {
    onTransitionsChange([...transitions, transition]);
    setEditingTransition(null);
    setEditingIndex(null);
  };

  const handleDeleteTransition = (index: number) => {
    const newTransitions = transitions.filter((_, i) => i !== index);
    onTransitionsChange(newTransitions);
  };

  const handleConditionChange = (index: number, condition: string) => {
    const newTransitions = [...transitions];
    newTransitions[index] = { ...newTransitions[index], condition };
    onTransitionsChange(newTransitions);
  };

  const handleActiveToggle = (index: number, active: boolean) => {
    const newTransitions = [...transitions];
    newTransitions[index] = { ...newTransitions[index], active };
    onTransitionsChange(newTransitions);
  };

  const handleSaveEditingTransition = (updated: DraftTransition) => {
    if (editingIndex === transitions.length) {
      // Creating new transition
      handleCreateTransition(updated);
    } else if (editingIndex !== null) {
      // Editing existing transition
      handleSaveTransition(updated);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Allowed Transitions
        </p>
        <Button
          size="sm"
          variant="outline"
          className="text-xs gap-1"
          disabled={disabled || availableStatusCodes.length < 2}
          onClick={handleAddTransition}
          title={availableStatusCodes.length < 2 ? 'Add at least 2 statuses to create transitions' : undefined}
        >
          <Plus className="w-3 h-3" /> Add Transition
        </Button>
      </div>

      {transitions.length === 0 ? (
        <div className="px-4 py-6 rounded-lg border border-dashed border-border/50 text-center">
          <p className="text-xs text-muted-foreground">No transitions yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Transitions define which status-to-status moves are allowed.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {transitions.map((transition, index) => (
            <TransitionRow
              key={`${transition.id ?? 'new'}-${index}`}
              transition={transition}
              index={index}
              availableStatusCodes={availableStatusCodes}
              onEdit={() => handleEditTransition(index)}
              onDelete={() => handleDeleteTransition(index)}
              onConditionChange={(condition) => handleConditionChange(index, condition)}
              onActiveToggle={(active) => handleActiveToggle(index, active)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      <TransitionEditModal
        open={editingTransition !== null}
        transition={editingTransition}
        availableStatusCodes={availableStatusCodes}
        onSave={handleSaveEditingTransition}
        onClose={() => {
          setEditingTransition(null);
          setEditingIndex(null);
        }}
        disabled={disabled}
      />
    </div>
  );
}
