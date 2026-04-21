import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared';
import { api } from '@/lib/api-client';
import { useApiQuery } from '@/hooks/useApiQuery';
import type { OrderDefinition } from '@/types';
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
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react';

type DraftStatus = {
  id?: string;
  statusCode: string;
  label: string;
  colorToken: string;
  isTerminal: boolean;
  active: boolean;
};

type DraftTransition = {
  id?: string;
  fromStatusCode: string;
  toStatusCode: string;
  condition: string;
  active: boolean;
};

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

const STATUS_COLORS: Record<string, string> = {
  yellow: 'bg-yellow-500/20 text-yellow-300',
  blue: 'bg-blue-500/20 text-blue-300',
  purple: 'bg-purple-500/20 text-purple-300',
  indigo: 'bg-indigo-500/20 text-indigo-300',
  cyan: 'bg-cyan-500/20 text-cyan-300',
  pink: 'bg-pink-500/20 text-pink-300',
  emerald: 'bg-emerald-500/20 text-emerald-300',
  teal: 'bg-teal-500/20 text-teal-300',
  green: 'bg-green-500/20 text-green-300',
  orange: 'bg-orange-500/20 text-orange-300',
  amber: 'bg-amber-500/20 text-amber-300',
};

const createEmptyDraft = (): DraftOrderDefinition => ({
  code: '',
  name: '',
  description: '',
  iconToken: '',
  colorToken: 'blue',
  active: true,
  statuses: [{ statusCode: 'pending', label: 'pending', colorToken: 'yellow', isTerminal: false, active: true }],
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

  const editorStatusCodes = useMemo(
    () => (editor?.statuses ?? []).map((status) => status.statusCode.trim()).filter(Boolean),
    [editor],
  );

  const updateStatus = (index: number, patch: Partial<DraftStatus>) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const statuses = prev.statuses.map((status, i) => (i === index ? { ...status, ...patch } : status));
      return { ...prev, statuses };
    });
  };

  const updateTransition = (index: number, patch: Partial<DraftTransition>) => {
    setEditor((prev) => {
      if (!prev) return prev;
      const transitions = prev.transitions.map((transition, i) => (i === index ? { ...transition, ...patch } : transition));
      return { ...prev, transitions };
    });
  };

  const moveStatus = (index: number, direction: -1 | 1) => {
    setEditor((prev) => {
      if (!prev) return prev;

      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.statuses.length) {
        return prev;
      }

      const nextStatuses = prev.statuses.slice();
      const [current] = nextStatuses.splice(index, 1);
      nextStatuses.splice(nextIndex, 0, current);

      return { ...prev, statuses: nextStatuses };
    });
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
      toast.success('Order definitions saved');
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">{editor.id ? 'Edit Order Definition' : 'Create Order Definition'}</h3>
              <Button size="sm" variant="ghost" onClick={() => setEditor(null)} disabled={saving}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Code</label>
                <input
                  value={editor.code}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, code: e.target.value } : prev))}
                  disabled={Boolean(editor.id) || saving}
                  className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  placeholder="one_time"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Name</label>
                <input
                  value={editor.name}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                  disabled={saving}
                  className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  placeholder="One-Time Order"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Color Token</label>
                <input
                  value={editor.colorToken}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, colorToken: e.target.value } : prev))}
                  disabled={saving}
                  className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  placeholder="blue"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Icon Token</label>
                <input
                  value={editor.iconToken}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, iconToken: e.target.value } : prev))}
                  disabled={saving}
                  className="mt-1 w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  placeholder="shopping-cart"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Description</label>
                <textarea
                  value={editor.description}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                  disabled={saving}
                  className="mt-1 w-full min-h-[72px] px-3 py-2 text-sm bg-background border border-input rounded-md"
                />
              </div>
              <label className="md:col-span-2 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={editor.active}
                  onChange={(e) => setEditor((prev) => (prev ? { ...prev, active: e.target.checked } : prev))}
                  disabled={saving}
                />
                Active
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Statuses</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                  disabled={saving}
                  onClick={() => setEditor((prev) => (prev
                    ? {
                        ...prev,
                        statuses: [...prev.statuses, { statusCode: '', label: '', colorToken: '', isTerminal: false, active: true }],
                      }
                    : prev))}
                >
                  <Plus className="w-3 h-3" /> Add Status
                </Button>
              </div>

              {editor.statuses.map((status, index) => (
                <div key={`${status.id ?? 'new'}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_120px_120px_auto] gap-2 items-center">
                  <input
                    value={status.statusCode}
                    onChange={(e) => updateStatus(index, { statusCode: e.target.value })}
                    disabled={saving}
                    className="h-9 px-3 text-sm bg-background border border-input rounded-md"
                    placeholder="status_code"
                  />
                  <input
                    value={status.label}
                    onChange={(e) => updateStatus(index, { label: e.target.value })}
                    disabled={saving}
                    className="h-9 px-3 text-sm bg-background border border-input rounded-md"
                    placeholder="Label"
                  />
                  <input
                    value={status.colorToken}
                    onChange={(e) => updateStatus(index, { colorToken: e.target.value })}
                    disabled={saving}
                    className="h-9 px-3 text-sm bg-background border border-input rounded-md"
                    placeholder="color"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={status.isTerminal}
                      onChange={(e) => updateStatus(index, { isTerminal: e.target.checked })}
                      disabled={saving}
                    />
                    Terminal
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={status.active}
                      onChange={(e) => updateStatus(index, { active: e.target.checked })}
                      disabled={saving}
                    />
                    Active
                  </label>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" disabled={saving || index === 0} onClick={() => moveStatus(index, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={saving || index === editor.statuses.length - 1} onClick={() => moveStatus(index, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={saving || editor.statuses.length === 1}
                      onClick={() => setEditor((prev) => (prev ? { ...prev, statuses: prev.statuses.filter((_, i) => i !== index) } : prev))}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Transitions</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1"
                  disabled={saving}
                  onClick={() => setEditor((prev) => (prev
                    ? {
                        ...prev,
                        transitions: [...prev.transitions, { fromStatusCode: '', toStatusCode: '', condition: '', active: true }],
                      }
                    : prev))}
                >
                  <Plus className="w-3 h-3" /> Add Transition
                </Button>
              </div>

              {editor.transitions.map((transition, index) => (
                <div key={`${transition.id ?? 'new'}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_120px_auto] gap-2 items-center">
                  <select
                    value={transition.fromStatusCode}
                    onChange={(e) => updateTransition(index, { fromStatusCode: e.target.value })}
                    disabled={saving}
                    className="h-9 px-3 text-sm bg-background border border-input rounded-md"
                  >
                    <option value="">From</option>
                    {editorStatusCodes.map((statusCode) => (
                      <option key={`from-${statusCode}`} value={statusCode}>{statusCode}</option>
                    ))}
                  </select>
                  <select
                    value={transition.toStatusCode}
                    onChange={(e) => updateTransition(index, { toStatusCode: e.target.value })}
                    disabled={saving}
                    className="h-9 px-3 text-sm bg-background border border-input rounded-md"
                  >
                    <option value="">To</option>
                    {editorStatusCodes.map((statusCode) => (
                      <option key={`to-${statusCode}`} value={statusCode}>{statusCode}</option>
                    ))}
                  </select>
                  <input
                    value={transition.condition}
                    onChange={(e) => updateTransition(index, { condition: e.target.value })}
                    disabled={saving}
                    className="h-9 px-3 text-sm bg-background border border-input rounded-md"
                    placeholder="Condition (optional)"
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={transition.active}
                      onChange={(e) => updateTransition(index, { active: e.target.checked })}
                      disabled={saving}
                    />
                    Active
                  </label>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={saving}
                    onClick={() => setEditor((prev) => (prev ? { ...prev, transitions: prev.transitions.filter((_, i) => i !== index) } : prev))}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" disabled={saving} onClick={() => setEditor(null)}>Cancel</Button>
              <Button onClick={() => void saveEditor()} disabled={saving} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
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
                    <div className={`p-2.5 rounded-xl ${STATUS_COLORS[type.colorToken ?? ''] ?? 'bg-muted/30 text-foreground'} border`}>
                      <Settings className="w-5 h-5" />
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
                                    className={`text-[9px] px-2 py-0.5 ${STATUS_COLORS[status.colorToken ?? ''] ?? 'bg-muted text-muted-foreground'}`}
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
