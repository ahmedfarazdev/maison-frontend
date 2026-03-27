// ============================================================
// Stock Reconciliation — Inventory Stock-Take Workflow
// Scan/count physical items, highlight discrepancies, apply adjustments
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { api } from '@/lib/api-client';
import { useApiQuery } from '@/hooks/useApiQuery';
import { PageHeader, StatusBadge, SectionCard, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  ClipboardCheck, Plus, Package, Beaker, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, Search, ArrowUpDown, Download, RotateCcw,
  Eye, Trash2, Check, X, Clock, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---- Types ----
interface ReconciliationSession {
  sessionId: string;
  scope: 'perfume' | 'packaging';
  title: string;
  status: 'in_progress' | 'finalized' | 'cancelled';
  notes: string | null;
  startedBy: string;
  totalItems: number;
  matchedItems: number;
  discrepancyItems: number;
  uncountedItems: number;
  finalizedAt: string | null;
  finalizedBy: string | null;
  createdAt: string;
  items?: ReconciliationItem[];
}

interface ReconciliationItem {
  id: number;
  sessionId: string;
  itemId: string;
  itemName: string;
  category: string | null;
  expectedQty: number;
  actualQty: number | null;
  variance: number | null;
  variancePercent: string | null;
  status: 'pending' | 'counted';
  notes: string | null;
  countedBy: string | null;
  countedAt: string | null;
}

type ViewMode = 'sessions' | 'detail';
type ItemFilter = 'all' | 'pending' | 'matched' | 'discrepancy' | 'surplus' | 'shortage';

export default function StockReconciliation() {
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: sessions, isLoading: sessionsLoading } = useApiQuery<ReconciliationSession[]>(
    () => api.mutations.reconciliation.listSessions(),
    [refreshKey],
  );

  const { data: sessionDetail, isLoading: detailLoading } = useApiQuery<ReconciliationSession | null>(
    () => activeSessionId ? api.mutations.reconciliation.getSession(activeSessionId) : Promise.resolve(null),
    [activeSessionId, refreshKey],
  );

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const openSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setViewMode('detail');
  };

  const backToSessions = () => {
    setViewMode('sessions');
    setActiveSessionId(null);
    refresh();
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Stock Reconciliation"
        subtitle="Physical stock-take workflow — count items and resolve discrepancies"
        breadcrumbs={
          viewMode === 'detail'
            ? [
              { label: 'Inventory', href: '/inventory/sealed-vault' },
              { label: 'Reconciliation', href: '/inventory/reconciliation' },
              { label: sessionDetail?.title || 'Session' },
            ]
            : [
              { label: 'Inventory', href: '/inventory/sealed-vault' },
              { label: 'Reconciliation' },
            ]
        }
        actions={
          viewMode === 'sessions' ? (
            <Button onClick={() => setShowCreateDialog(true)} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
              <Plus className="w-4 h-4" /> New Stock Take
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {viewMode === 'sessions' ? (
          <SessionsList
            sessions={sessions || []}
            loading={sessionsLoading}
            onOpen={openSession}
            onDelete={(id) => {
              api.mutations.reconciliation.deleteSession(id).then(refresh);
            }}
          />
        ) : (
          <SessionDetail
            session={sessionDetail}
            loading={detailLoading}
            onBack={backToSessions}
            onRefresh={refresh}
            onFinalize={() => setShowFinalizeDialog(true)}
          />
        )}
      </div>

      {/* Create Session Dialog */}
      <CreateSessionDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreated={(sessionId) => {
          setShowCreateDialog(false);
          openSession(sessionId);
        }}
      />

      {/* Finalize Dialog */}
      {activeSessionId && (
        <FinalizeDialog
          open={showFinalizeDialog}
          onClose={() => setShowFinalizeDialog(false)}
          sessionId={activeSessionId}
          scope={sessionDetail?.scope || 'packaging'}
          onFinalized={() => {
            setShowFinalizeDialog(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Sessions List
// ============================================================
function SessionsList({ sessions, loading, onOpen, onDelete }: {
  sessions: ReconciliationSession[];
  loading: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No reconciliation sessions"
        description="Start a new stock take to verify physical inventory against system records."
      />
    );
  }

  const statusConfig: Record<string, { label: string; variant: 'gold' | 'success' | 'destructive' }> = {
    in_progress: { label: 'In Progress', variant: 'gold' },
    finalized: { label: 'Finalized', variant: 'success' },
    cancelled: { label: 'Cancelled', variant: 'destructive' },
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sessions.map(s => {
        const cfg = statusConfig[s.status] || statusConfig.in_progress;
        const countedPct = s.totalItems > 0 ? Math.round(((s.totalItems - s.uncountedItems) / s.totalItems) * 100) : 0;
        return (
          <div
            key={s.sessionId}
            className="bg-card border border-border rounded-lg overflow-hidden hover:border-gold/30 transition-colors cursor-pointer"
            onClick={() => onOpen(s.sessionId)}
          >
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {s.scope === 'packaging' ? (
                    <Package className="w-4 h-4 text-gold" />
                  ) : (
                    <Beaker className="w-4 h-4 text-info" />
                  )}
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {s.scope}
                  </span>
                </div>
                <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>
              </div>

              <h3 className="font-semibold text-sm line-clamp-2">{s.title}</h3>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span className="font-mono">{countedPct}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      countedPct === 100 ? 'bg-success' : 'bg-gold',
                    )}
                    style={{ width: `${countedPct}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-success/5 rounded-md py-1.5">
                  <div className="text-xs font-mono font-semibold text-success">{s.matchedItems}</div>
                  <div className="text-[10px] text-muted-foreground">Match</div>
                </div>
                <div className="bg-destructive/5 rounded-md py-1.5">
                  <div className="text-xs font-mono font-semibold text-destructive">{s.discrepancyItems}</div>
                  <div className="text-[10px] text-muted-foreground">Discrep.</div>
                </div>
                <div className="bg-muted/50 rounded-md py-1.5">
                  <div className="text-xs font-mono font-semibold text-muted-foreground">{s.uncountedItems}</div>
                  <div className="text-[10px] text-muted-foreground">Pending</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border">
                <span>By {s.startedBy}</span>
                <span>{new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="flex border-t border-border">
              <button
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-foreground hover:bg-accent/50 transition-colors"
                onClick={(e) => { e.stopPropagation(); onOpen(s.sessionId); }}
              >
                <Eye className="w-3.5 h-3.5" /> View
              </button>
              {s.status === 'in_progress' && (
                <button
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors border-l border-border"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this session?')) onDelete(s.sessionId);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Session Detail — Count Items + Discrepancy Highlighting
// ============================================================
function SessionDetail({ session, loading, onBack, onRefresh, onFinalize }: {
  session: ReconciliationSession | null;
  loading: boolean;
  onBack: () => void;
  onRefresh: () => void;
  onFinalize: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [sortField, setSortField] = useState<'name' | 'variance' | 'status'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const items = session?.items || [];

  const filteredItems = useMemo(() => {
    let result = items.filter(item =>
      item.itemName.toLowerCase().includes(search.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(search.toLowerCase()) ||
      item.itemId.toLowerCase().includes(search.toLowerCase())
    );

    switch (filter) {
      case 'pending': result = result.filter(i => i.status === 'pending'); break;
      case 'matched': result = result.filter(i => i.status === 'counted' && (i.variance === 0 || i.variance === null)); break;
      case 'discrepancy': result = result.filter(i => i.status === 'counted' && i.variance !== null && i.variance !== 0); break;
      case 'surplus': result = result.filter(i => i.status === 'counted' && i.variance !== null && i.variance > 0); break;
      case 'shortage': result = result.filter(i => i.status === 'counted' && i.variance !== null && i.variance < 0); break;
    }

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.itemName.localeCompare(b.itemName);
      else if (sortField === 'variance') cmp = Math.abs(Number(a.variance) || 0) - Math.abs(Number(b.variance) || 0);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [items, search, filter, sortField, sortDir]);

  // Summary stats
  const counted = items.filter(i => i.status === 'counted').length;
  const matched = items.filter(i => i.status === 'counted' && (i.variance === 0 || i.variance === null)).length;
  const discrepancies = items.filter(i => i.status === 'counted' && i.variance !== null && i.variance !== 0).length;
  const shortages = items.filter(i => i.status === 'counted' && i.variance !== null && i.variance < 0).length;
  const surpluses = items.filter(i => i.status === 'counted' && i.variance !== null && i.variance > 0).length;
  const pending = items.filter(i => i.status === 'pending').length;
  const progress = items.length > 0 ? Math.round((counted / items.length) * 100) : 0;

  const handleStartEdit = (item: ReconciliationItem) => {
    setEditingId(item.id);
    setEditQty(item.actualQty !== null ? String(item.actualQty) : '');
    setEditNotes(item.notes || '');
  };

  const handleSaveCount = async () => {
    if (editingId === null) return;
    const qty = parseInt(editQty, 10);
    if (isNaN(qty) || qty < 0) return;
    setSaving(true);
    try {
      await api.mutations.reconciliation.countItem(editingId, qty, editNotes || undefined);
      setEditingId(null);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditQty('');
    setEditNotes('');
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  // CSV export
  const exportCSV = () => {
    const headers = ['Item ID', 'Item Name', 'Category', 'Expected Qty', 'Actual Qty', 'Variance', 'Variance %', 'Status', 'Notes', 'Counted By', 'Counted At'];
    const rows = items.map(i => [
      i.itemId, i.itemName, i.category || '', i.expectedQty,
      i.actualQty ?? '', i.variance ?? '', i.variancePercent ?? '',
      i.status, i.notes || '', i.countedBy || '', i.countedAt || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${session?.sessionId || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-card border border-border rounded-lg animate-pulse" />)}</div>;
  }

  if (!session) {
    return <EmptyState icon={ClipboardCheck} title="Session not found" description="This reconciliation session could not be loaded." />;
  }

  const isFinalized = session.status !== 'in_progress';

  return (
    <div className="space-y-6">
      {/* Back button + session header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{session.title}</h2>
            <StatusBadge variant={session.status === 'finalized' ? 'success' : session.status === 'cancelled' ? 'destructive' : 'gold'}>
              {session.status.replace('_', ' ')}
            </StatusBadge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {session.scope === 'packaging' ? 'Packaging Materials' : 'Perfume Inventory'} · {items.length} items · Started {new Date(session.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          {!isFinalized && (
            <Button
              onClick={onFinalize}
              className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5"
              size="sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Finalize
            </Button>
          )}
        </div>
      </div>

      {/* Progress + KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="col-span-2 md:col-span-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Counting Progress</span>
              <span className="text-sm font-mono font-semibold">{progress}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  progress === 100 ? 'bg-success' : progress > 50 ? 'bg-gold' : 'bg-info',
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>{counted} of {items.length} items counted</span>
              {isFinalized && session.finalizedBy && (
                <span>Finalized by {session.finalizedBy} on {session.finalizedAt ? new Date(session.finalizedAt).toLocaleDateString() : ''}</span>
              )}
            </div>
          </div>
        </div>

        <KPIBox icon={CheckCircle2} label="Matched" value={matched} color="text-success" bg="bg-success/5" />
        <KPIBox icon={AlertTriangle} label="Discrepancies" value={discrepancies} color="text-destructive" bg="bg-destructive/5" />
        <KPIBox icon={ArrowUpDown} label="Shortages" value={shortages} color="text-warning" bg="bg-warning/5" />
        <KPIBox icon={ArrowUpDown} label="Surpluses" value={surpluses} color="text-info" bg="bg-info/5" />
        <KPIBox icon={Clock} label="Pending" value={pending} color="text-muted-foreground" bg="bg-muted/50" />
        <KPIBox icon={Package} label="Total Items" value={items.length} color="text-foreground" bg="bg-card" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(['all', 'pending', 'matched', 'discrepancy', 'shortage', 'surplus'] as ItemFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
                filter === f
                  ? 'bg-gold/15 text-gold ring-1 ring-gold/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Items table */}
      <SectionCard title={`Items (${filteredItems.length})`} subtitle="Click a row to enter the physical count">
        <div className="overflow-x-auto -mx-4 -mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs w-10">#</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs cursor-pointer" onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">Item <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Category</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs text-right">Expected</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs text-right">Actual</th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs text-right cursor-pointer" onClick={() => toggleSort('variance')}>
                  <span className="flex items-center justify-end gap-1">Variance <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs cursor-pointer" onClick={() => toggleSort('status')}>
                  <span className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs">Notes</th>
                {!isFinalized && <th className="px-4 py-2.5 font-medium text-muted-foreground text-xs w-24">Action</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const isEditing = editingId === item.id;
                const hasVariance = item.status === 'counted' && item.variance !== null && item.variance !== 0;
                const isMatch = item.status === 'counted' && (item.variance === 0 || item.variance === null);
                const isShortage = hasVariance && (item.variance ?? 0) < 0;
                const isSurplus = hasVariance && (item.variance ?? 0) > 0;

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-border/50 transition-colors',
                      isEditing && 'bg-gold/5 ring-1 ring-inset ring-gold/20',
                      !isEditing && isMatch && 'bg-success/3',
                      !isEditing && isShortage && 'bg-destructive/5',
                      !isEditing && isSurplus && 'bg-info/5',
                      !isEditing && !isFinalized && item.status === 'pending' && 'hover:bg-accent/30 cursor-pointer',
                    )}
                    onClick={() => {
                      if (!isFinalized && !isEditing && item.status === 'pending') handleStartEdit(item);
                    }}
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{idx + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-sm">{item.itemName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{item.itemId}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted-foreground">{item.category || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm">{item.expectedQty}</td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          min={0}
                          value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          className="w-20 h-8 text-right ml-auto"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveCount();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                      ) : (
                        <span className={cn('font-mono text-sm', item.actualQty === null && 'text-muted-foreground')}>
                          {item.actualQty !== null ? item.actualQty : '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {item.variance !== null && item.variance !== undefined ? (
                        <span className={cn(
                          'font-mono text-sm font-semibold',
                          item.variance === 0 && 'text-success',
                          (item.variance ?? 0) < 0 && 'text-destructive',
                          (item.variance ?? 0) > 0 && 'text-info',
                        )}>
                          {(item.variance ?? 0) > 0 ? '+' : ''}{item.variance}
                          {item.variancePercent && (
                            <span className="text-[10px] ml-1 opacity-70">({item.variancePercent}%)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.status === 'pending' && (
                        <StatusBadge variant="muted">Pending</StatusBadge>
                      )}
                      {isMatch && (
                        <StatusBadge variant="success">Match</StatusBadge>
                      )}
                      {isShortage && (
                        <StatusBadge variant="destructive">Shortage</StatusBadge>
                      )}
                      {isSurplus && (
                        <StatusBadge variant="info">Surplus</StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <Input
                          placeholder="Notes..."
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          className="h-8 text-xs"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground line-clamp-1">{item.notes || ''}</span>
                      )}
                    </td>
                    {!isFinalized && (
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" onClick={handleSaveCount} disabled={saving} className="h-7 w-7 p-0">
                              <Check className="w-4 h-4 text-success" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0">
                              <X className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        ) : item.status === 'counted' ? (
                          <Button size="sm" variant="ghost" onClick={() => handleStartEdit(item)} className="h-7 text-xs gap-1">
                            <RotateCcw className="w-3 h-3" /> Recount
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleStartEdit(item)} className="h-7 text-xs gap-1 text-gold">
                            Count
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={isFinalized ? 8 : 9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No items match your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ============================================================
// Create Session Dialog
// ============================================================
function CreateSessionDialog({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (sessionId: string) => void;
}) {
  const [scope, setScope] = useState<'packaging' | 'perfume'>('packaging');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const session = await api.mutations.reconciliation.createSession({
        scope,
        title: title || undefined,
        notes: notes || undefined,
      });
      onCreated(session.sessionId);
      setTitle('');
      setNotes('');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Stock Take Session</DialogTitle>
          <DialogDescription>
            Create a reconciliation session to count physical inventory against system records.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Inventory Scope</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setScope('packaging')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                  scope === 'packaging'
                    ? 'border-gold bg-gold/5'
                    : 'border-border hover:border-gold/30',
                )}
              >
                <Package className={cn('w-8 h-8', scope === 'packaging' ? 'text-gold' : 'text-muted-foreground')} />
                <span className="text-sm font-medium">Packaging</span>
                <span className="text-[11px] text-muted-foreground">Materials & supplies</span>
              </button>
              <button
                onClick={() => setScope('perfume')}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors',
                  scope === 'perfume'
                    ? 'border-info bg-info/5'
                    : 'border-border hover:border-info/30',
                )}
              >
                <Beaker className={cn('w-8 h-8', scope === 'perfume' ? 'text-info' : 'text-muted-foreground')} />
                <span className="text-sm font-medium">Perfume</span>
                <span className="text-[11px] text-muted-foreground">Sealed & decant bottles</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Title (optional)</label>
            <Input
              placeholder={`${scope === 'packaging' ? 'Packaging' : 'Perfume'} Stock Take - ${new Date().toLocaleDateString()}`}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              placeholder="Any notes about this stock take..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={creating} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
            {creating ? 'Creating...' : 'Start Stock Take'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Finalize Dialog
// ============================================================
function FinalizeDialog({ open, onClose, sessionId, scope, onFinalized }: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  scope: string;
  onFinalized: () => void;
}) {
  const [applyAdjustments, setApplyAdjustments] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await api.mutations.reconciliation.finalizeSession(sessionId, applyAdjustments);
      onFinalized();
    } finally {
      setFinalizing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finalize Stock Take</DialogTitle>
          <DialogDescription>
            This will lock the session and mark it as complete. You can optionally apply stock adjustments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {scope === 'packaging' && (
            <label className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={applyAdjustments}
                onChange={e => setApplyAdjustments(e.target.checked)}
                className="mt-0.5 rounded border-border"
              />
              <div>
                <div className="text-sm font-medium">Apply stock adjustments</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Update packaging SKU quantities to match the physical count. This will overwrite current system stock levels for items with discrepancies.
                </div>
              </div>
            </label>
          )}

          <div className="bg-warning/5 border border-warning/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Once finalized, this session cannot be modified. Uncounted items will be recorded as-is. Make sure all physical counts are entered before proceeding.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleFinalize} disabled={finalizing} className="bg-gold hover:bg-gold/90 text-gold-foreground gap-1.5">
            {finalizing ? 'Finalizing...' : 'Finalize Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// KPI Box
// ============================================================
function KPIBox({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={cn('rounded-lg border border-border p-3', bg)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', color)} />
        <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-xl font-bold font-mono', color)}>{value}</div>
    </div>
  );
}
