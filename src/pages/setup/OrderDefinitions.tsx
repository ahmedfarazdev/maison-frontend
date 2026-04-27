import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared';
import { api } from '@/lib/api-client';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { OrderDefinition } from '@/types';
import {
  WorkflowBuilder,
  type DraftStatus,
  type DraftTransition,
  ColorPicker,
  IconPicker,
  DynamicIcon,
  getColorStyle,
} from '@/components/order-definitions';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react';

type DraftOrderDefinition = {
  id?: string;
  code: string;
  name: string;
  description: string;
  iconToken: string;
  colorToken: string;
  active: boolean;
  statuses: DraftStatus[];
  transitions: DraftTransition[];
};

const createTempId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};


const createEmptyDraft = (): DraftOrderDefinition => ({
  code: '',
  name: '',
  description: '',
  iconToken: '',
  colorToken: 'blue',
  active: true,
  statuses: [{ clientTempId: createTempId(), statusCode: 'pending', label: 'pending', colorToken: 'yellow', isTerminal: false, active: true }],
  transitions: [],
});

const toDraft = (definition: OrderDefinition): DraftOrderDefinition => ({
  id: definition.id,
  code: definition.code,
  name: definition.name,
  description: definition.description ?? '',
  iconToken: definition.iconToken ?? '',
  colorToken: definition.colorToken ?? 'blue',
  active: definition.active,
  statuses: definition.statuses
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((status) => ({
      id: status.id,
      statusCode: status.statusCode,
      label: status.label,
      colorToken: status.colorToken ?? '',
      isTerminal: status.isTerminal,
      active: status.active,
    })),
  transitions: definition.transitions.map((transition) => ({
    id: transition.id,
    fromStatusCode: transition.fromStatusCode,
    toStatusCode: transition.toStatusCode,
    condition: transition.condition ?? '',
    active: transition.active,
  })),
});

export default function OrderDefinitions() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editor, setEditor] = useState<DraftOrderDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading, error, refetch } = useApiQuery<OrderDefinition[]>(() => api.orderDefinitions.list(), []);
  const definitions = data ?? [];

  const updateEditor = <K extends keyof DraftOrderDefinition>(
    key: K,
    value: DraftOrderDefinition[K]
  ) => {
    setEditor((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const saveEditor = async () => {
    if (!editor || saving) return;

    if (!editor.code.trim() || !editor.name.trim()) {
      toast.error('Code and name are required');
      return;
    }

    if (editor.statuses.length === 0) {
      toast.error('At least one status is required');
      return;
    }

    setSaving(true);

    try {
      const statusesPayload = editor.statuses.map((status, index) => ({
        statusCode: status.statusCode.trim().toLowerCase(),
        label: status.label.trim() || status.statusCode.trim(),
        colorToken: status.colorToken.trim() || null,
        position: index,
        isTerminal: status.isTerminal,
        active: status.active,
      }));

      const transitionsPayload = editor.transitions
        .filter((transition) => transition.fromStatusCode.trim() && transition.toStatusCode.trim())
        .map((transition) => ({
          fromStatusCode: transition.fromStatusCode.trim().toLowerCase(),
          toStatusCode: transition.toStatusCode.trim().toLowerCase(),
          condition: transition.condition.trim() || null,
          active: transition.active,
        }));

      if (editor.id) {
        await api.mutations.orderDefinitions.update(editor.id, {
          name: editor.name.trim(),
          description: editor.description.trim() || null,
          iconToken: editor.iconToken.trim() || null,
          colorToken: editor.colorToken.trim() || null,
          active: editor.active,
        });

        await api.mutations.orderDefinitions.updateWorkflow(editor.id, {
          statuses: statusesPayload,
          transitions: transitionsPayload,
        });
      } else {
        await api.mutations.orderDefinitions.create({
          code: editor.code.trim().toLowerCase(),
          name: editor.name.trim(),
          description: editor.description.trim() || null,
          iconToken: editor.iconToken.trim() || null,
          colorToken: editor.colorToken.trim() || null,
          active: editor.active,
          statuses: statusesPayload,
          transitions: transitionsPayload,
        });
      }

      await refetch();
      setEditor(null);
      toast.success('Order definition saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save order definition');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId || isDeleting) return;

    setIsDeleting(true);
    try {
      await api.mutations.orderDefinitions.delete(deletingId);
      await refetch();
      if (expanded === deletingId) {
        setExpanded(null);
      }
      toast.success('Order definition deleted');
      setDeletingId(null);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete order definition');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <AlertDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeletingId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete order definition</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the order definition and its workflow from system setup.
          </AlertDialogDescription>
          <div className="flex justify-end gap-3 mt-4">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <PageHeader
        title="Order Definitions"
        subtitle="Configure order types, status workflows, and processing rules"
        breadcrumbs={[{ label: 'System Setup' }, { label: 'Order Definitions' }]}
        actions={(
          <Button
            size="sm"
            className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
            onClick={() => setEditor(createEmptyDraft())}
            disabled={saving}
          >
            <Plus className="w-3.5 h-3.5" /> Add Order Type
          </Button>
        )}
      />

      {editor && (
        <Card className="bg-card/70 border-gold/30">
          <CardContent className="p-5 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{editor.id ? 'Edit Order Definition' : 'Create Order Definition'}</h3>
              <Button size="sm" variant="ghost" onClick={() => setEditor(null)} disabled={saving}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Metadata Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Code</label>
                <input
                  value={editor.code}
                  onChange={(e) => updateEditor('code', e.target.value)}
                  disabled={Boolean(editor.id) || saving}
                  className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  placeholder="one_time"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Name</label>
                <input
                  value={editor.name}
                  onChange={(e) => updateEditor('name', e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  placeholder="One-Time Order"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Color Token</label>
                <ColorPicker
                  value={editor.colorToken}
                  onChange={(color) => updateEditor('colorToken', color)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Icon Token</label>
                <IconPicker
                  value={editor.iconToken}
                  onChange={(icon) => updateEditor('iconToken', icon)}
                  disabled={saving}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Description</label>
                <textarea
                  value={editor.description}
                  onChange={(e) => updateEditor('description', e.target.value)}
                  disabled={saving}
                  className="mt-1 w-full min-h-[72px] px-3 py-2 text-sm bg-background border border-input rounded-md"
                />
              </div>
              <label className="md:col-span-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editor.active}
                  onChange={(e) => updateEditor('active', e.target.checked)}
                  disabled={saving}
                />
                Active
              </label>
            </div>

            {/* Workflow Builder */}
            <WorkflowBuilder
              statuses={editor.statuses}
              transitions={editor.transitions}
              onStatusesChange={(statuses) => updateEditor('statuses', statuses)}
              onTransitionsChange={(transitions) => updateEditor('transitions', transitions)}
              disabled={saving}
            />

            {/* Save/Cancel Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-input">
              <Button variant="outline" disabled={saving} onClick={() => setEditor(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => void saveEditor()}
                disabled={saving}
                className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Saving...' : 'Save Definition'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-56">
          <Loader2 className="w-7 h-7 animate-spin text-gold" />
        </div>
      ) : error ? (
        <Card className="bg-card/60 border-border/50">
          <CardContent className="p-6 text-sm text-destructive">Failed to load order definitions: {error}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {definitions.map((type) => {
            const isExpanded = expanded === type.id;
            return (
              <Card
                key={type.id}
                className={`bg-card/60 border-border/50 cursor-pointer transition-all hover:border-gold/30 ${isExpanded ? 'border-gold/40' : ''}`}
                onClick={() => setExpanded(isExpanded ? null : type.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-2.5 rounded-xl border", getColorStyle(type.colorToken))}>
                      <DynamicIcon token={type.iconToken} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-foreground">{type.name}</h3>
                        <Badge variant="outline" className={type.active ? 'bg-green-500/10 text-green-400 border-green-500/30 text-[9px]' : 'text-[9px]'}>
                          {type.active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline" className="text-[9px]">{type.code}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{type.description || 'No description'}</p>

                      {isExpanded && (
                        <div className="mt-4 space-y-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Status Workflow</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {type.statuses
                              .slice()
                              .sort((a, b) => a.position - b.position)
                              .map((status, i, arr) => (
                                <div key={status.id} className="flex items-center gap-1.5">
                                  <Badge
                                    variant="outline"
                                    className={cn("text-[9px] px-2 py-0.5", getColorStyle(status.colorToken))}
                                  >
                                    {status.label}
                                  </Badge>
                                  {i < arr.length - 1 && (
                                    <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                                  )}
                                </div>
                              ))}
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1"
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditor(toDraft(type));
                              }}
                            >
                              <Settings className="w-3 h-3" /> Edit Workflow
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1 text-destructive"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeletingId(type.id);
                              }}
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
