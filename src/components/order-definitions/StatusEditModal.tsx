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
import type { DraftStatus } from './types';
import { generateStatusCode, COLOR_TOKEN_STYLES, CONDITION_TYPES } from './utils';

interface StatusEditModalProps {
  open: boolean;
  status: DraftStatus | null;
  onSave: (status: DraftStatus) => void;
  onClose: () => void;
  disabled?: boolean;
}

export function StatusEditModal({ open, status, onSave, onClose, disabled }: StatusEditModalProps) {
  const [draft, setDraft] = useState<DraftStatus | null>(null);

  useEffect(() => {
    if (open && status) {
      setDraft({ ...status });
    }
  }, [open, status]);

  if (!draft) return null;

  const handleLabelChange = (newLabel: string) => {
    // Auto-generate statusCode from label if it was previously empty or matches old label
    const newCode = generateStatusCode(newLabel);
    setDraft({
      ...draft,
      label: newLabel,
      statusCode: newCode,
    });
  };

  const handleSave = () => {
    if (!draft.label.trim() || !draft.statusCode.trim()) {
      return;
    }
    onSave(draft);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Label
            </label>
            <input
              type="text"
              value={draft.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              disabled={disabled}
              className="mt-1.5 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
              placeholder="e.g., Processing Order"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Status Code (auto-generated)
            </label>
            <input
              type="text"
              value={draft.statusCode}
              onChange={(e) => setDraft({ ...draft, statusCode: e.target.value })}
              disabled={disabled}
              className="mt-1.5 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
              placeholder="e.g., processing_order"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Auto-generated from label, but you can override it.
            </p>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Color Token
            </label>
            <select
              value={draft.colorToken}
              onChange={(e) => setDraft({ ...draft, colorToken: e.target.value })}
              disabled={disabled}
              className="mt-1.5 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
            >
              <option value="">— None —</option>
              {Object.keys(COLOR_TOKEN_STYLES).map((color) => (
                <option key={color} value={color}>
                  {color.charAt(0).toUpperCase() + color.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isTerminal}
                onChange={(e) => setDraft({ ...draft, isTerminal: e.target.checked })}
                disabled={disabled}
              />
              <span>Is Terminal (final status)</span>
            </label>
            <p className="text-[10px] text-muted-foreground ml-6">
              Terminal statuses mark the end of a workflow.
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
            disabled={disabled || !draft.label.trim() || !draft.statusCode.trim()}
            className="bg-gold hover:bg-gold/90 text-gold-foreground"
          >
            {disabled ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Save Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
