import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { DraftTransition } from './types';
import { CONDITION_TYPES } from './utils';

interface TransitionEditModalProps {
  open: boolean;
  transition: DraftTransition | null;
  availableStatusCodes: string[];
  onSave: (transition: DraftTransition) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function TransitionEditModal({
  open,
  transition,
  availableStatusCodes,
  onSave,
  onClose,
  disabled,
}: TransitionEditModalProps) {
  const [draft, setDraft] = useState<DraftTransition | null>(null);
  const [customCondition, setCustomCondition] = useState('');

  useEffect(() => {
    if (open && transition) {
      setDraft({ ...transition });
      // Check if condition is custom (not in predefined list)
      const isPredefined = CONDITION_TYPES.some((c) => c.value === transition.condition);
      setCustomCondition(isPredefined ? '' : transition.condition);
    }
  }, [open, transition]);

  if (!draft) return null;

  const handleConditionChange = (value: string) => {
    if (value === '') {
      // Custom condition mode
      setDraft({ ...draft, condition: customCondition });
    } else {
      // Predefined condition
      setDraft({ ...draft, condition: value });
      setCustomCondition('');
    }
  };

  const handleCustomConditionChange = (value: string) => {
    setCustomCondition(value);
    setDraft({ ...draft, condition: value });
  };

  const handleSave = () => {
    if (!draft.fromStatusCode || !draft.toStatusCode) {
      return;
    }
    onSave(draft);
    onClose();
  };

  const isPredefinedCondition = CONDITION_TYPES.some((c) => c.value === draft.condition);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transition</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              From Status
            </label>
            <select
              value={draft.fromStatusCode}
              onChange={(e) => setDraft({ ...draft, fromStatusCode: e.target.value })}
              disabled={disabled}
              className="mt-1.5 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
            >
              <option value="">— Select —</option>
              {availableStatusCodes.map((code) => (
                <option key={`from-${code}`} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              To Status
            </label>
            <select
              value={draft.toStatusCode}
              onChange={(e) => setDraft({ ...draft, toStatusCode: e.target.value })}
              disabled={disabled}
              className="mt-1.5 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
            >
              <option value="">— Select —</option>
              {availableStatusCodes.map((code) => (
                <option key={`to-${code}`} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Condition (optional)
            </label>
            <select
              value={isPredefinedCondition ? draft.condition : ''}
              onChange={(e) => handleConditionChange(e.target.value)}
              disabled={disabled}
              className="mt-1.5 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
            >
              <option value="">Custom condition</option>
              {CONDITION_TYPES.map((cond) => (
                <option key={cond.value} value={cond.value}>
                  {cond.label}
                </option>
              ))}
            </select>

            {!isPredefinedCondition && (
              <input
                type="text"
                value={customCondition}
                onChange={(e) => handleCustomConditionChange(e.target.value)}
                disabled={disabled}
                className="mt-2 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                placeholder="e.g., custom_approval_needed"
              />
            )}

            <p className="text-[10px] text-muted-foreground mt-1.5">
              Choose from predefined conditions or enter a custom one.
            </p>
          </div>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                disabled={disabled}
              />
              <span>Active</span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={disabled || !draft.fromStatusCode || !draft.toStatusCode}
            className="bg-gold hover:bg-gold/90 text-gold-foreground"
          >
            {disabled ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Save Transition
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
