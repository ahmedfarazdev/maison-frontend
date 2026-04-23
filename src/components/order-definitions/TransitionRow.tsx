import { useState } from 'react';
import { ArrowRight, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftTransition } from './types';
import { CONDITION_TYPES, getConditionLabel } from './utils';

interface TransitionRowProps {
  transition: DraftTransition;
  index: number;
  availableStatusCodes: string[];
  onEdit: () => void;
  onDelete: () => void;
  onConditionChange: (condition: string) => void;
  onActiveToggle: (active: boolean) => void;
  disabled?: boolean;
}

export function TransitionRow({
  transition,
  index,
  availableStatusCodes,
  onEdit,
  onDelete,
  onConditionChange,
  onActiveToggle,
  disabled,
}: TransitionRowProps) {
  const [isEditingCondition, setIsEditingCondition] = useState(false);
  const isPredefinedCondition = CONDITION_TYPES.some((c) => c.value === transition.condition);
  const conditionLabel = transition.condition ? getConditionLabel(transition.condition) : '(no condition)';

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-input bg-muted/30 hover:bg-muted/50 transition-colors">
      {/* From Status */}
      <div className="min-w-0 flex-shrink-0">
        <div className="text-xs font-medium text-muted-foreground">FROM</div>
        <div className="text-sm font-semibold text-foreground">
          {transition.fromStatusCode || '—'}
        </div>
      </div>

      {/* Arrow */}
      <ArrowRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />

      {/* To Status */}
      <div className="min-w-0 flex-shrink-0">
        <div className="text-xs font-medium text-muted-foreground">TO</div>
        <div className="text-sm font-semibold text-foreground">
          {transition.toStatusCode || '—'}
        </div>
      </div>

      {/* Condition Display/Editor */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-muted-foreground">CONDITION</div>
        {isEditingCondition ? (
          <div className="flex items-center gap-1 mt-1">
            <select
              value={isPredefinedCondition ? transition.condition : ''}
              onChange={(e) => {
                if (e.target.value) {
                  onConditionChange(e.target.value);
                  setIsEditingCondition(false);
                } else {
                  // Switch to custom mode (keep current value or clear)
                }
              }}
              disabled={disabled}
              className="flex-1 h-7 px-2 text-xs bg-background border border-input rounded-md"
            >
              <option value="">Custom...</option>
              {CONDITION_TYPES.map((cond) => (
                <option key={cond.value} value={cond.value}>
                  {cond.label}
                </option>
              ))}
            </select>
            {!isPredefinedCondition && (
              <input
                type="text"
                value={transition.condition}
                onChange={(e) => onConditionChange(e.target.value)}
                onBlur={() => setIsEditingCondition(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingCondition(false)}
                disabled={disabled}
                autoFocus
                className="w-24 h-7 px-2 text-xs bg-background border border-input rounded-md"
                placeholder="custom..."
              />
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 flex-shrink-0"
              onClick={() => setIsEditingCondition(false)}
              disabled={disabled}
            >
              <span className="text-sm">✓</span>
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingCondition(true)}
            disabled={disabled}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline cursor-pointer mt-1 block truncate"
          >
            {conditionLabel}
          </button>
        )}
      </div>

      {/* Active Toggle */}
      <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
        <input
          type="checkbox"
          checked={transition.active}
          onChange={(e) => onActiveToggle(e.target.checked)}
          disabled={disabled}
        />
        <span className="hidden sm:inline">Active</span>
      </label>

      {/* Edit Button */}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 hover:bg-background/50 flex-shrink-0"
        onClick={onEdit}
        disabled={disabled}
        title="Edit transition"
      >
        <Edit2 className="w-3.5 h-3.5" />
      </Button>

      {/* Delete Button */}
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
        onClick={onDelete}
        disabled={disabled}
        title="Delete transition"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
