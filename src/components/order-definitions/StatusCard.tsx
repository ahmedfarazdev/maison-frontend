import { CSSProperties } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Flag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftStatus } from './types';
import { getColorStyle, getTerminalStyle } from './utils';

interface StatusCardProps {
  itemId: string;
  status: DraftStatus;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function StatusCard({ itemId, status, onEdit, onDelete, disabled }: StatusCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: itemId,
    disabled,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isTerminal = status.isTerminal;
  const colorStyle = isTerminal ? getTerminalStyle(status.colorToken) : getColorStyle(status.colorToken);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg border transition-all',
        colorStyle,
        isDragging && 'opacity-50 shadow-lg ring-2 ring-gold/50',
        !isDragging && 'hover:shadow-md',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        disabled={disabled}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{status.label || '(unnamed)'}</p>
          {isTerminal && (
            <Flag className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{status.statusCode}</p>
      </div>

      {!status.active && (
        <div className="text-[9px] px-2 py-1 bg-muted/50 rounded text-muted-foreground">
          Inactive
        </div>
      )}

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 hover:bg-background/50"
          onClick={onEdit}
          disabled={disabled}
          title="Edit status"
        >
          <span className="w-3.5 h-3.5 text-foreground/60">✎</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          disabled={disabled}
          title="Delete status"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
